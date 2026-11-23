import {QA_URL} from '../../../qa/security/private-worker-bootstrap-core.mjs';
import {digest} from './authorization.mjs';

export const finalizePath = '/api/integrations/google-calendar/oauth/finalize';
export const pendingCookie = '__Secure-adphor-calendar-pending';

function result(status) {
  return new Response(null, {status, headers: {
    'Cache-Control': 'no-store',
    'Referrer-Policy': 'no-referrer',
    'Set-Cookie': `${pendingCookie}=; Path=${finalizePath}; Max-Age=0; HttpOnly; Secure; SameSite=Strict`,
  }});
}

export function createCalendarOAuthFinalize({verifyAccess, verifySession, lookupRole, pending, completeAuthorization}) {
  return async function finalize(request) {
    const url = new URL(request.url);
    if (url.origin !== QA_URL || url.pathname !== finalizePath) return result(404);
    if (request.method !== 'POST') return result(405);
    if (request.headers.get('Origin') !== QA_URL) return result(403);
    const projects = url.searchParams.getAll('project');
    if (projects.length !== 1 || [...url.searchParams].length !== 1 ||
        !/^[a-z0-9][a-z0-9-]{0,99}$/.test(projects[0]) || request.body !== null) return result(400);
    const [projectId] = projects;
    const bearer = /^Bearer ([A-Za-z0-9._-]{1,8192})$/.exec(request.headers.get('Authorization') ?? '')?.[1];
    if (!bearer) return result(401);
    const prefix = pendingCookie + '=';
    const values = (request.headers.get('Cookie') ?? '').split(';')
      .map(value => value.trim()).filter(value => value.startsWith(prefix));
    const nonce = values.length === 1 ? values[0].slice(prefix.length) : '';
    if (!/^[A-Za-z0-9_-]{43}$/.test(nonce)) return result(400);

    try {
      const access = await verifyAccess(request);
      if (!access?.subject) return result(403);
      const session = await verifySession(bearer);
      if (!session?.userId) return result(401);
      if (session.aal !== 'aal2') return result(403);
      const role = await lookupRole({bearer, userId: session.userId, projectId});
      if (role !== 'admin' && role !== 'coordinator') return result(403);
      const actor = {accessSubject: access.subject, userId: session.userId, projectId};
      const authorization = await pending.consume({pendingDigest: await digest(nonce), ...actor});
      if (!authorization) return result(409);
      await completeAuthorization({authorization, ...actor});
      return result(204);
    } catch {
      return result(503);
    }
  };
}
