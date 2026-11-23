import assert from 'node:assert/strict';
import test from 'node:test';
import {QA_URL} from '../qa/security/private-worker-bootstrap-core.mjs';
import {createCalendarOAuthStart} from '../backend/src/calendar-oauth/start.mjs';

const endpoint = QA_URL + '/api/integrations/google-calendar/oauth/start?project=pilot';
function makeRequest({url = endpoint, origin = QA_URL, method = 'POST', token = 'qa-fixture'} = {}) {
  return new Request(url, {method, headers: {Origin: origin, Authorization: token ? 'Bearer ' + token : ''}});
}

function fixture(overrides = {}) {
  const saved = [];
  const parameters = [];
  const start = createCalendarOAuthStart({
    verifyAccess: async () => ({subject: 'access-user'}),
    verifySession: async () => ({aal: 'aal2', userId: 'qa-user'}),
    async lookupRole(input) {
      parameters.push(input);
      return input.projectId === 'pilot' ? 'admin' : null;
    },
    store: {async save(transaction) { saved.push(transaction); }},
    clientId: 'test-client',
    ...overrides,
  });
  return {start, saved, parameters};
}

test('OAuth start stores state under the verified actor before returning a redirect target', async () => {
  const {start, saved, parameters} = fixture();
  const response = await start(makeRequest());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const cookie = response.headers.get('set-cookie');
  assert.match(cookie, /Max-Age=300; HttpOnly; Secure; SameSite=Lax$/);
  assert.match(cookie, /Path=\/api\/integrations\/google-calendar\/oauth\/callback;/);
  const body = await response.json();
  assert.deepEqual(Object.keys(body), ['authorizationUrl']);
  assert.equal(new URL(body.authorizationUrl).origin, 'https://accounts.google.com');
  assert.equal(saved[0].accessSubject, 'access-user');
  assert.equal(saved[0].userId, 'qa-user');
  assert.equal(saved[0].projectId, 'pilot');
  assert.ok(!body.authorizationUrl.includes(saved[0].verifier));
  assert.deepEqual(parameters, [{bearer: 'qa-fixture', userId: 'qa-user', projectId: 'pilot'}]);
});

test('OAuth start denies missing Access, AAL1, revoked membership and cross-tenant input', async () => {
  for (const [overrides, request, status] of [
    [{verifyAccess: async () => null}, makeRequest(), 403],
    [{verifySession: async () => null}, makeRequest(), 401],
    [{verifySession: async () => ({aal: 'aal1', userId: 'qa-user'})}, makeRequest(), 403],
    [{lookupRole: async () => null}, makeRequest(), 403],
    [{lookupRole: async () => 'viewer'}, makeRequest(), 403],
    [{}, makeRequest({url: endpoint.replace('pilot', 'other')}), 403],
    [{}, makeRequest({url: endpoint + '&project=other'}), 400],
    [{}, makeRequest({origin: 'https://example.test'}), 403],
    [{}, makeRequest({method: 'GET'}), 405],
    [{}, makeRequest({token: ''}), 401],
  ]) {
    const {start, saved} = fixture(overrides);
    const response = await start(request);
    assert.equal(response.status, status);
    assert.equal(response.headers.get('set-cookie'), null);
    assert.equal(saved.length, 0);
  }
});

test('OAuth start returns no cookie or redirect when persistence fails', async () => {
  const {start} = fixture({store: {async save() { throw Error('fixture storage failure'); }}});
  const response = await start(makeRequest());
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('set-cookie'), null);
  assert.equal(await response.text(), '');
});

test('Supabase authorization verifies the bearer before using its AAL2 claim and queries membership under RLS', async () => {
  const {createCalendarSupabaseAuthorization} = await import('../backend/src/calendar-oauth/supabase-authorization.mjs');
  const calls = [];
  let authStatus = 200;
  let membership = [{role: 'coordinator'}];
  const adapter = createCalendarSupabaseAuthorization({
    publishableKey: 'sb_publishable_fixture',
    async transport(url, options) {
      calls.push([new URL(url), options]);
      if (url.endsWith('/auth/v1/user')) return Response.json({id: 'qa-user'}, {status: authStatus});
      return Response.json(membership);
    },
  });
  const jwt = (aal, sub = 'qa-user') =>
    ['fixture', Buffer.from(JSON.stringify({sub, aal, role: 'authenticated'})).toString('base64url'), 'signature'].join('.');
  const bearer = jwt('aal2');
  assert.deepEqual(await adapter.verifySession(bearer), {userId: 'qa-user', aal: 'aal2'});
  assert.equal((await adapter.verifySession(jwt('aal1'))).aal, null);
  assert.equal((await adapter.verifySession(jwt('aal2', 'other-user'))).aal, null);
  const input = {bearer, userId: 'qa-user', projectId: 'pilot'};
  assert.equal(await adapter.lookupRole(input), 'coordinator');
  const [rest, options] = calls.at(-1);
  assert.equal(rest.hostname, 'qfctnnnnltghepwujpdm.supabase.co');
  assert.equal(rest.searchParams.get('project_id'), 'eq.pilot');
  assert.equal(rest.searchParams.get('user_id'), 'eq.qa-user');
  assert.equal(options.headers.Authorization, 'Bearer ' + bearer);
  assert.equal(options.redirect, 'error');
  membership = [{role: 'admin'}, {role: 'coordinator'}];
  assert.equal(await adapter.lookupRole(input), null);
  authStatus = 401;
  assert.equal(await adapter.verifySession(bearer), null);
  assert.throws(() => createCalendarSupabaseAuthorization({publishableKey: 'sb_secret_fixture'}));
});
