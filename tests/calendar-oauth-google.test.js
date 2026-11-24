import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {PGlite} from '@electric-sql/pglite';
import {QA_URL} from '../qa/security/private-worker-bootstrap-core.mjs';
import {callbackPath, digest} from '../backend/src/calendar-oauth/authorization.mjs';
import {createCalendarOAuthTransactionCipher} from '../backend/src/calendar-oauth/transaction-cipher.mjs';
import {createCalendarOAuthConnectionStore} from '../backend/src/calendar-oauth/connection-store.mjs';
import {createGoogleCalendarAuthorization} from '../backend/src/calendar-oauth/google-authorization.mjs';

test('Google exchange verifies identity and saves the refresh authorization encrypted for its tenant', async () => {
  const clientId = 'fixture-client';
  const expectedEmail = 'pilot@example.test';
  const now = Math.floor(Date.now() / 1000);
  const authorization = {
    code: 'fixture-code', verifier: 'a'.repeat(43), googleNonce: 'b'.repeat(43),
    redirectUri: QA_URL + callbackPath,
  };
  const actor = {userId: 'fixture-user', projectId: 'fixture-property', authorization};
  const signing = {name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256'};
  const key = await crypto.subtle.generateKey({
    ...signing, modulusLength: 2048, publicExponent: Uint8Array.of(1, 0, 1),
  }, true, ['sign', 'verify']);
  const jwk = {...await crypto.subtle.exportKey('jwk', key.publicKey), kid: 'google-fixture', use: 'sig'};
  const encode = object => Buffer.from(JSON.stringify(object)).toString('base64url');
  async function sign(overrides = {}) {
    const header = encode({alg: 'RS256', kid: jwk.kid});
    const claims = encode({
      iss: 'https://accounts.google.com', sub: 'fixture-subject', aud: clientId,
      nonce: authorization.googleNonce, email: expectedEmail, email_verified: true,
      iat: now - 1, exp: now + 120, ...overrides,
    });
    const input = header + '.' + claims;
    const signature = await crypto.subtle.sign(signing, key.privateKey, new TextEncoder().encode(input));
    return input + '.' + Buffer.from(signature).toString('base64url');
  }

  const database = new PGlite();
  try {
    const schema = new URL('../backend/src/calendar-oauth/transactions.sql', import.meta.url);
    await database.exec(await readFile(schema, 'utf8'));
    await database.exec('SET ROLE adphor_qa_calendar_oauth_state');
    const cipher = await createCalendarOAuthTransactionCipher(crypto.getRandomValues(new Uint8Array(32)));
    const refreshToken = 'fixture-refresh-token';
    const scope = 'openid https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/calendar.events.owned https://www.googleapis.com/auth/calendar.events.freebusy';
    let grant = {scope, refresh_token: refreshToken, id_token: await sign()};
    const complete = createGoogleCalendarAuthorization({
      clientId, clientSecret: 'fixture-secret', expectedEmail, clock: () => now * 1000,
      saveConnection: createCalendarOAuthConnectionStore({database, ...cipher}),
      async transport(url, request) {
        assert.equal(request.redirect, 'manual');
        if (url === 'https://oauth2.googleapis.com/token') {
          assert.equal(request.body.get('code_verifier'), authorization.verifier);
          assert.equal(request.body.get('redirect_uri'), authorization.redirectUri);
          assert.equal(request.body.get('grant_type'), 'authorization_code');
          return Response.json(grant);
        }
        assert.equal(url, 'https://www.googleapis.com/oauth2/v3/certs');
        return Response.json({keys: [jwk]});
      },
    });
    for (const claims of [{aud: 'other-client'}, {iss: 'https://example.test'}, {email: 'other@example.test'},
      {nonce: 'other-nonce'}, {email_verified: false}, {exp: now}]) {
      grant.id_token = await sign(claims);
      await assert.rejects(complete(actor), /identity failed/);
    }
    grant.id_token = (await sign()).replace(/\.[^.]+$/, '.' + 'A'.repeat(342));
    await assert.rejects(complete(actor), /signature invalid/);
    grant.id_token = await sign();
    grant.scope = scope + ' https://www.googleapis.com/auth/calendar';
    await assert.rejects(complete(actor), /required authorization/);
    grant.scope = scope;
    await complete(actor);
    await assert.rejects(complete(actor), /unique constraint/);
    await assert.rejects(database.query('SELECT payload FROM calendar_oauth_private.connections'), /permission denied/);
    await database.exec('RESET ROLE');
    const {rows} = await database.query('SELECT * FROM calendar_oauth_private.connections');
    assert.equal(rows.length, 1);
    assert.equal(rows[0].google_subject, 'fixture-subject');
    assert.doesNotMatch(JSON.stringify(rows), /fixture-refresh-token|pilot@example/);
    const context = await digest(JSON.stringify(['connection', actor.userId, actor.projectId]));
    assert.deepEqual(await cipher.open(rows[0].payload, context), {refreshToken});
    await assert.rejects(cipher.open(rows[0].payload, await digest('other-tenant')));
  } finally {
    await database.close();
  }
});
