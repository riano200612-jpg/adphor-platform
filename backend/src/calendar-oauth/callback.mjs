import {QA_URL} from '../../../qa/security/private-worker-bootstrap-core.mjs';
import {callbackPath, consumeCalendarAuthorization} from './authorization.mjs';
import {correlationCookie} from './start.mjs';
import {finalizePath, pendingCookie} from './finalize.mjs';

function reply(status, extra = {}) {
  return new Response(null, {status, headers: {
    'Cache-Control': 'no-store',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    ...extra,
  }});
}

function readNonce(request) {
  const prefix = correlationCookie + '=';
  const values = (request.headers.get('Cookie') ?? '').split(';')
    .map(value => value.trim()).filter(value => value.startsWith(prefix));
  return values.length === 1 ? values[0].slice(prefix.length) : null;
}

// stageAuthorization holds the code server-side for a subsequent authenticated
// finalization. It must bind the pending record to the original actor/project.
export function createCalendarOAuthCallback({verifyAccess, store, stageAuthorization}) {
  return async function callback(request) {
    const url = new URL(request.url);
    if (url.origin !== QA_URL || url.pathname !== callbackPath) return reply(404);
    if (request.method !== 'GET') return reply(405);

    try {
      const access = await verifyAccess(request);
      if (typeof access?.subject !== 'string' || !access.subject) return reply(403);
      const states = url.searchParams.getAll('state');
      const codes = url.searchParams.getAll('code');
      const errors = url.searchParams.getAll('error');
      if (states.length !== 1 || errors.length > 1 ||
          (errors.length ? codes.length !== 0 :
            codes.length !== 1 || !/^[\x21-\x7e]{1,2048}$/.test(codes[0]))) return reply(400);

      const transaction = await consumeCalendarAuthorization({
        store, state: states[0], browserNonce: readNonce(request), accessSubject: access.subject,
      });
      if (!transaction || transaction.redirectUri !== url.origin + callbackPath) return reply(400);
      const pending = errors.length ? null :
        await stageAuthorization({code: codes[0], transaction, accessSubject: access.subject});
      if (!errors.length && !/^[A-Za-z0-9_-]{43}$/.test(pending ?? '')) return reply(503);
      const response = reply(303, {
        Location: QA_URL + '/',
        'Set-Cookie': `${correlationCookie}=; Path=${callbackPath}; Max-Age=0; HttpOnly; Secure; SameSite=Lax`,
      });
      if (pending) response.headers.append('Set-Cookie',
        `${pendingCookie}=${pending}; Path=${finalizePath}; Max-Age=180; HttpOnly; Secure; SameSite=Strict`);
      return response;
    } catch {
      return reply(503);
    }
  };
}
