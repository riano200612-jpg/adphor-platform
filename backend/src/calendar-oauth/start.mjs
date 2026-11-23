import {QA_URL} from '../../../qa/security/private-worker-bootstrap-core.mjs';
import {callbackPath, prepareCalendarAuthorization} from './authorization.mjs';

const startPath = '/api/integrations/google-calendar/oauth/start';
export const correlationCookie = '__Secure-adphor-calendar-oauth';
const responseHeaders = {
  'Cache-Control': 'no-store',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
};

function deny(status) {
  return new Response(null, {status, headers: responseHeaders});
}

// The verifiers are trusted server adapters. verifyAccess and verifySession
// validate provider tokens, and lookupRole uses the end-user session and RLS.
export function createCalendarOAuthStart({verifyAccess, verifySession, lookupRole, store, clientId}) {
  return async function start(request) {
    const url = new URL(request.url);
    if (url.origin !== QA_URL || url.pathname !== startPath) return deny(404);
    if (request.method !== 'POST') return deny(405);
    if (request.headers.get('Origin') !== QA_URL) return deny(403);
    const projects = url.searchParams.getAll('project');
    if (projects.length !== 1 || [...url.searchParams].length !== 1 ||
        !/^[a-z0-9][a-z0-9-]{0,99}$/.test(projects[0]) || request.body !== null) return deny(400);
    const [projectId] = projects;
    const authorization = request.headers.get('Authorization') ?? '';
    const bearer = /^Bearer ([A-Za-z0-9._-]{1,8192})$/.exec(authorization)?.[1];
    if (!bearer) return deny(401);

    try {
      const access = await verifyAccess(request);
      if (typeof access?.subject !== 'string' || !access.subject) return deny(403);
      const session = await verifySession(bearer);
      if (typeof session?.userId !== 'string' || !session.userId) return deny(401);
      if (session.aal !== 'aal2') return deny(403);
      const role = await lookupRole({bearer, userId: session.userId, projectId});
      if (role !== 'admin' && role !== 'coordinator') return deny(403);
      const {authorizationUrl, browserNonce, transaction} = await prepareCalendarAuthorization({
        verifiedQaOrigin: QA_URL, clientId, userId: session.userId, projectId,
        accessSubject: access.subject,
      });
      await store.save(transaction);
      const headers = new Headers(responseHeaders);
      headers.set('Set-Cookie',
        `${correlationCookie}=${browserNonce}; Path=${callbackPath}; Max-Age=300; HttpOnly; Secure; SameSite=Lax`);
      return Response.json({authorizationUrl}, {headers});
    } catch {
      return deny(503);
    }
  };
}
