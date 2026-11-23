import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {PGlite} from '@electric-sql/pglite';
import {QA_URL} from '../qa/security/private-worker-bootstrap-core.mjs';
import {createCalendarAccessVerifier} from '../backend/src/calendar-oauth/access.mjs';
import {createCalendarOAuthPendingStore} from '../backend/src/calendar-oauth/pending-store.mjs';
import {createCalendarOAuthRoutes} from '../backend/src/calendar-oauth/routes.mjs';
import {createCalendarOAuthTransactionCipher} from '../backend/src/calendar-oauth/transaction-cipher.mjs';
import {createCalendarOAuthTransactionStore} from '../backend/src/calendar-oauth/transaction-store.mjs';

const issuer = 'https://fixture.cloudflareaccess.com';
const audience = 'a'.repeat(64);
const now = Date.now();
const expires = Math.floor(now / 1000) + 300;
const encoder = new TextEncoder();
const credentials = await crypto.subtle.generateKey({
  name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256', modulusLength: 2048,
  publicExponent: Uint8Array.of(1, 0, 1),
}, true, ['sign', 'verify']);
const key = {...await crypto.subtle.exportKey('jwk', credentials.publicKey), kid: 'fixture', use: 'sig'};
const b64 = value => Buffer.from(JSON.stringify(value)).toString('base64url');

async function sign(claims = {}, header = {}) {
  const input = b64({alg: 'RS256', kid: key.kid, ...header}) + '.' +
    b64({iss: issuer, aud: [audience], sub: 'access-user', type: 'app', exp: expires, ...claims});
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', credentials.privateKey, encoder.encode(input));
  return input + '.' + Buffer.from(signature).toString('base64url');
}

const access = {
  issuer, audience, clock: () => now,
  async transport(url, options) {
    assert.equal(url, issuer + '/cdn-cgi/access/certs');
    assert.equal(options.redirect, 'manual');
    return Response.json({keys: [key]});
  },
};

test('Cloudflare Access verifies RS256 and rejects missing, forged, expired and mis-scoped assertions', async () => {
  const verify = createCalendarAccessVerifier(access);
  const request = token => new Request(QA_URL, {headers: {'Cf-Access-Jwt-Assertion': token}});
  const verified = await sign();
  assert.deepEqual(await verify(request(verified)), {subject: 'access-user'});
  assert.equal(await verify(new Request(QA_URL, {headers: {Cookie: 'CF_Authorization=' + verified}})), null);
  for (const token of [
    verified.slice(0, verified.lastIndexOf('.') + 1) + 'A'.repeat(342),
    await sign({iss: 'https://other.cloudflareaccess.com'}),
    await sign({aud: ['b'.repeat(64)]}),
    await sign({exp: Math.floor(now / 1000)}),
    await sign({nbf: expires}),
    await sign({type: 'org'}),
    await sign({}, {alg: 'none'}),
    await sign({}, {kid: 'missing'}),
  ]) assert.equal(await verify(request(token)), null);
  await assert.rejects(createCalendarAccessVerifier({
    ...access, transport: async () => new Response(null, {status: 503}),
  })(request(verified)));
  assert.throws(() => createCalendarAccessVerifier({...access, issuer: 'https://example.test'}));
});

test('QA route handlers share Access verification and consume SQL state only for the initiating browser', async () => {
  assert.throws(() => createCalendarOAuthRoutes({access, clientId: 'fixture'}), /runtime dependencies/);
  const database = new PGlite();
  try {
    await database.exec(await readFile(new URL('../backend/src/calendar-oauth/transactions.sql', import.meta.url), 'utf8'));
    await database.exec('CREATE ROLE authenticated; SET ROLE authenticated');
    await assert.rejects(database.query('SELECT payload FROM calendar_oauth_private.pending'), /permission denied/);
    await database.exec('RESET ROLE; SET ROLE adphor_qa_calendar_oauth_state');
    const cipher = await createCalendarOAuthTransactionCipher(crypto.getRandomValues(new Uint8Array(32)));
    const completedAuthorizations = [];
    let userId = 'qa-user';
    let membership = [{role: 'admin'}];
    const oauth = createCalendarOAuthRoutes({
      access, clientId: 'fixture',
      store: createCalendarOAuthTransactionStore({database, ...cipher}),
      pending: createCalendarOAuthPendingStore({database, ...cipher}),
      completeAuthorization: async data => {completedAuthorizations.push(data);},
      supabase: {
        publishableKey: 'sb_publishable_fixture',
        transport: async url => url.endsWith('/auth/v1/user')
          ? Response.json({id: userId}) : Response.json(membership),
      },
    });
    const accessJwt = await sign();
    const session = aal => 'fixture.' + b64({role: 'authenticated', sub: userId, aal}) + '.signature';
    const start = (aal, assertion = accessJwt) => oauth.start(new Request(
      QA_URL + '/api/integrations/google-calendar/oauth/start?project=pilot',
      {method: 'POST', headers: {Origin: QA_URL, Authorization: 'Bearer ' + session(aal),
        'Cf-Access-Jwt-Assertion': assertion}},
    ));
    assert.equal((await start('aal2', '')).status, 403);
    assert.equal((await start('aal1')).status, 403);
    const begun = await start('aal2');
    assert.equal(begun.status, 200);
    const cookie = begun.headers.get('set-cookie').split(';')[0];
    const {authorizationUrl} = await begun.json();
    const state = new URL(authorizationUrl).searchParams.get('state');
    const redirect = new URL(new URL(authorizationUrl).searchParams.get('redirect_uri'));
    redirect.search = new URLSearchParams({state, code: 'fixture-code'}).toString();
    const callback = (nonce = cookie, assertion = accessJwt, url = redirect) => oauth.callback(
      new Request(url, {headers: {Cookie: nonce, 'Cf-Access-Jwt-Assertion': assertion}}),
    );
    assert.equal((await callback(cookie, '')).status, 403);
    assert.equal((await callback('')).status, 400);
    assert.equal((await callback(cookie + '; ' + cookie)).status, 400);
    assert.equal((await callback(cookie, await sign({sub: 'other-user'}))).status, 400);
    assert.equal((await callback(cookie, accessJwt, 'https://example.test' + redirect.pathname + redirect.search)).status, 404);
    const [first, second] = await Promise.all([callback(), callback()]);
    assert.deepEqual([first.status, second.status].sort(), [303, 400]);
    const completed = first.status === 303 ? first : second;
    assert.equal(completed.headers.get('location'), QA_URL + '/');
    assert.match(completed.headers.get('set-cookie'), /Max-Age=0/);
    assert.equal(await completed.text(), '');
    assert.equal(completedAuthorizations.length, 0);
    assert.equal((await callback()).status, 400);
    const pending = completed.headers.getSetCookie().find(value => value.startsWith('__Secure-adphor-calendar-pending=')).split(';')[0];
    const finalize = ({aal = 'aal2', assertion = accessJwt, project = 'pilot', cookie = pending} = {}) =>
      oauth.finalize(new Request(QA_URL + '/api/integrations/google-calendar/oauth/finalize?project=' + project, {
        method: 'POST',
        headers: {Origin: QA_URL, Authorization: 'Bearer ' + session(aal), Cookie: cookie,
          'Cf-Access-Jwt-Assertion': assertion},
      }));
    assert.equal((await finalize({cookie: ''})).status, 400);
    assert.equal((await finalize({assertion: ''})).status, 403);
    assert.equal((await finalize({aal: 'aal1'})).status, 403);
    assert.equal((await finalize({assertion: await sign({sub: 'other-user'})})).status, 409);
    assert.equal((await finalize({project: 'other'})).status, 409);
    userId = 'other-qa-user';
    assert.equal((await finalize()).status, 409);
    userId = 'qa-user';
    membership = [];
    assert.equal((await finalize()).status, 403);
    membership = [{role: 'admin'}];
    const {rows} = await database.query('SELECT payload FROM calendar_oauth_private.pending');
    assert.doesNotMatch(JSON.stringify(rows), /fixture-code|verifier|googleNonce/);
    await assert.rejects(database.query(
      "UPDATE calendar_oauth_private.pending SET expires_at = CURRENT_TIMESTAMP + interval '1 day'",
    ), /permission denied/);
    const linked = await Promise.all([finalize(), finalize()]);
    assert.deepEqual(linked.map(response => response.status).sort(), [204, 409]);
    assert.equal(completedAuthorizations.length, 1);
    const [connection] = completedAuthorizations;
    assert.equal(connection.authorization.code, 'fixture-code');
    assert.equal(connection.userId, 'qa-user');
    assert.equal(connection.projectId, 'pilot');
    assert.equal((await finalize()).status, 409);
    await database.exec(
      'RESET ROLE; REVOKE USAGE ON SCHEMA calendar_oauth_private FROM adphor_qa_calendar_oauth_state; ' +
      'SET ROLE adphor_qa_calendar_oauth_state',
    );
    await assert.rejects(database.query('SELECT payload FROM calendar_oauth_private.pending'), /permission denied/);
  } finally {
    await database.close();
  }
});
