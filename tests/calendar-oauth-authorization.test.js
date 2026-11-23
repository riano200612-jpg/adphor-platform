import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import test from 'node:test';
import { prepareCalendarAuthorization } from '../backend/src/calendar-oauth/authorization.mjs';
import { QA_URL } from '../qa/security/private-worker-bootstrap-core.mjs';

const input = {
  verifiedQaOrigin: QA_URL, clientId: 'test-client', userId: 'user',
  projectId: 'property', accessSubject: 'access-user', now: 1000,
};
const hash = value => createHash('sha256').update(value).digest('base64url');

test('Calendar OAuth prepares a short-lived, browser-bound PKCE transaction for QA', async () => {
  const { authorizationUrl, browserNonce, transaction } = await prepareCalendarAuthorization(input);
  const url = new URL(authorizationUrl);
  assert.equal(url.origin + url.pathname, 'https://accounts.google.com/o/oauth2/v2/auth');
  const fields = url.searchParams;
  assert.equal(fields.get('redirect_uri'), QA_URL + '/api/integrations/google-calendar/oauth/callback');
  assert.equal(fields.get('client_id'), input.clientId);
  assert.equal(fields.get('response_type'), 'code');
  assert.equal(fields.get('access_type'), 'offline');
  assert.equal(fields.get('scope'), 'openid email https://www.googleapis.com/auth/calendar.events.readonly');
  assert.equal(fields.get('code_challenge_method'), 'S256');
  assert.equal(fields.get('code_challenge'), hash(transaction.verifier));
  assert.equal(fields.get('nonce'), transaction.nonce);
  assert.equal(transaction.stateDigest, hash(fields.get('state')));
  assert.equal(transaction.browserNonceDigest, hash(browserNonce));
  assert.equal(transaction.expiresAt, 301000);
  for (const field of ['userId', 'projectId', 'accessSubject']) assert.equal(transaction[field], input[field]);
  assert.ok(!authorizationUrl.includes(transaction.verifier));
  assert.ok(!authorizationUrl.includes(browserNonce));
  const next = await prepareCalendarAuthorization(input);
  assert.notEqual(next.transaction.stateDigest, transaction.stateDigest);
  assert.notEqual(next.browserNonce, browserNonce);
});

test('Calendar OAuth rejects unexpected origins and missing authorization context', async () => {
  for (const patch of [
    { verifiedQaOrigin: 'https://adphor-platform.pages.dev' },
    { verifiedQaOrigin: 'https://qa-pqrs-carrusel-integracion.adphor-platform.pages.dev' },
    { verifiedQaOrigin: QA_URL + '/path' }, { clientId: '' }, { userId: '' },
    { projectId: '' }, { accessSubject: '' }, { now: NaN }, { now: Number.MAX_SAFE_INTEGER },
  ]) await assert.rejects(prepareCalendarAuthorization({ ...input, ...patch }));
});
