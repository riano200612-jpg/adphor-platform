import {QA_URL} from '../../../qa/security/private-worker-bootstrap-core.mjs';
import {callbackPath} from './authorization.mjs';

const signing = {name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256'};
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', {fatal: true});
const calendarScope = 'https://www.googleapis.com/auth/calendar.events.readonly';
const supportedScopes = new Set([
  calendarScope, 'openid', 'email', 'https://www.googleapis.com/auth/userinfo.email',
]);

function bytes(segment) {
  if (!/^[A-Za-z0-9_-]+$/.test(segment)) throw new Error('Invalid Google token.');
  return Uint8Array.from(atob(segment.replaceAll('-', '+').replaceAll('_', '/')), c => c.charCodeAt(0));
}

export function createGoogleCalendarAuthorization({
  clientId, clientSecret, expectedEmail, saveConnection, transport = fetch, clock = Date.now,
}) {
  if (![clientId, clientSecret, expectedEmail].every(value => typeof value === 'string' && value.length) ||
      typeof saveConnection !== 'function') throw new Error('Google Calendar QA configuration unavailable.');

  async function fetchJson(url, options) {
    const response = await transport(url, {...options, redirect: 'manual', signal: AbortSignal.timeout(8000)});
    if (!response.ok) throw new Error('Google OAuth request failed.');
    return response.json();
  }

  return async function completeAuthorization({authorization, userId, projectId}) {
    const {code, verifier, redirectUri, googleNonce} = authorization;
    if (redirectUri !== QA_URL + callbackPath || typeof code !== 'string' ||
        !/^[\x21-\x7e]{1,2048}$/.test(code) || typeof verifier !== 'string' || typeof googleNonce !== 'string' ||
        !/^[A-Za-z0-9_-]{43}$/.test(verifier) || !/^[A-Za-z0-9_-]{43}$/.test(googleNonce)) {
      throw new Error('Invalid pending Google authorization.');
    }

    const grant = await fetchJson('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {'Content-Type': 'application/x-www-form-urlencoded'},
      body: new URLSearchParams({
        client_id: clientId, client_secret: clientSecret, code,
        code_verifier: verifier, grant_type: 'authorization_code', redirect_uri: redirectUri,
      }),
    });
    const scopes = typeof grant?.scope === 'string' ? grant.scope.split(/\s+/) : [];
    if (!scopes.includes(calendarScope) || scopes.some(scope => !supportedScopes.has(scope)) ||
        typeof grant?.refresh_token !== 'string' || !grant.refresh_token || grant.refresh_token.length > 4096 ||
        typeof grant?.id_token !== 'string' || grant.id_token.length > 8192) {
      throw new Error('Google did not issue the required authorization.');
    }

    const parts = grant.id_token.split('.');
    if (parts.length !== 3) throw new Error('Invalid Google ID token.');
    const [headerPart, claimsPart, signaturePart] = parts;
    const header = JSON.parse(decoder.decode(bytes(headerPart)));
    const claims = JSON.parse(decoder.decode(bytes(claimsPart)));
    const now = Math.floor(clock() / 1000);
    if (header?.alg !== 'RS256' || header.crit !== undefined ||
        typeof header.kid !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(header.kid) ||
        !['https://accounts.google.com', 'accounts.google.com'].includes(claims?.iss) ||
        claims.aud !== clientId || (claims.azp !== undefined && claims.azp !== clientId) ||
        !Number.isSafeInteger(claims.exp) || claims.exp <= now ||
        !Number.isSafeInteger(claims.iat) || claims.iat > now ||
        claims.nonce !== googleNonce || claims.email_verified !== true ||
        typeof claims.email !== 'string' || claims.email.toLowerCase() !== expectedEmail.toLowerCase() ||
        typeof claims.sub !== 'string' || !/^[A-Za-z0-9_-]{1,255}$/.test(claims.sub)) {
      throw new Error('Google identity failed validation.');
    }

    const {keys} = await fetchJson('https://www.googleapis.com/oauth2/v3/certs');
    const matches = Array.isArray(keys) ? keys.filter(key => key?.kid === header.kid) : [];
    const [jwk] = matches;
    if (matches.length !== 1 || jwk.kty !== 'RSA' || jwk.alg !== 'RS256' || jwk.use !== 'sig') {
      throw new Error('Google signing key unavailable.');
    }
    const key = await crypto.subtle.importKey('jwk', jwk, signing, false, ['verify']);
    if (key.algorithm.modulusLength < 2048 || !await crypto.subtle.verify(
      signing, key, bytes(signaturePart), encoder.encode(headerPart + '.' + claimsPart),
    ) || claims.exp <= Math.floor(clock() / 1000)) throw new Error('Google identity signature invalid.');

    await saveConnection({userId, projectId, googleSubject: claims.sub, refreshToken: grant.refresh_token});
  };
}
