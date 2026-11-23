import { QA_URL } from '../../../qa/security/private-worker-bootstrap-core.mjs';

export const callbackPath = '/api/integrations/google-calendar/oauth/callback';
const pilotScopes = ['openid', 'email', 'https://www.googleapis.com/auth/calendar.events.readonly'];
const lifetimeMs = 5 * 60 * 1000;

function base64url(bytes) {
  return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

export function randomValue() {
  return base64url(crypto.getRandomValues(new Uint8Array(32)));
}

export async function digest(value) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return base64url(new Uint8Array(hash));
}

// The caller must verify Access, Supabase AAL2 and membership before invoking this
// function. Persist the transaction server-side before redirecting the browser.
export async function prepareCalendarAuthorization({
  verifiedQaOrigin, clientId, userId, projectId, accessSubject, now = Date.now(),
}) {
  if (verifiedQaOrigin !== QA_URL || !clientId || !userId || !projectId || !accessSubject ||
      !Number.isSafeInteger(now) || now <= 0 || now > Number.MAX_SAFE_INTEGER - lifetimeMs) {
    throw new Error('Calendar OAuth requires the verified QA origin and an authorized actor.');
  }

  const state = randomValue();
  const browserNonce = randomValue();
  const nonce = randomValue();
  const verifier = randomValue();
  const redirectUri = new URL(callbackPath, verifiedQaOrigin).href;
  const authorizationUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authorizationUrl.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: pilotScopes.join(' '),
    access_type: 'offline',
    state,
    nonce,
    code_challenge: await digest(verifier),
    code_challenge_method: 'S256',
  }).toString();

  return {
    authorizationUrl: authorizationUrl.href,
    browserNonce,
    transaction: {
      stateDigest: await digest(state),
      browserNonceDigest: await digest(browserNonce),
      nonce,
      verifier,
      redirectUri,
      userId,
      projectId,
      accessSubject,
      expiresAt: now + lifetimeMs,
    },
  };
}

// Access must already be verified. A later authenticated finalization must
// re-check Supabase AAL2, the user and current membership before linking.
export async function consumeCalendarAuthorization({
  store, state, browserNonce, accessSubject, now = Date.now(),
}) {
  const validNonce = value => typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value);
  if (!validNonce(state) || !validNonce(browserNonce) || !accessSubject ||
      !Number.isSafeInteger(now) || now <= 0) return null;
  return store.consume({
    stateDigest: await digest(state),
    browserNonceDigest: await digest(browserNonce),
    accessSubject,
    now,
  });
}
