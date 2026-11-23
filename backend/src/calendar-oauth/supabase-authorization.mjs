import {
  parseValidatedAal2, QA_PROJECT_URL,
} from '../../../supabase/functions/qa-calendar-availability/core.js';

export function createCalendarSupabaseAuthorization({publishableKey, pilotEmail, transport = fetch}) {
  if (typeof publishableKey !== 'string' || !/^sb_publishable_[A-Za-z0-9_-]+$/.test(publishableKey)) {
    throw new Error('Calendar OAuth requires a Supabase QA publishable key.');
  }

  if (pilotEmail !== undefined && (typeof pilotEmail !== 'string' || !pilotEmail.trim())) {
    throw new Error('Calendar OAuth requires the configured QA pilot.');
  }

  async function read(path, bearer) {
    const response = await transport(QA_PROJECT_URL + path, {
      headers: {apikey: publishableKey, Authorization: 'Bearer ' + bearer, Accept: 'application/json'},
      redirect: 'manual',
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    if (response.status === 401 || response.status === 403) return null;
    if (!response.ok) throw new Error('Supabase QA authorization unavailable.');
    return response.json();
  }

  return {
    async verifySession(bearer) {
      const user = await read('/auth/v1/user', bearer);
      if (typeof user?.id !== 'string' || !user.id) return null;
      if (pilotEmail !== undefined && (typeof user.email !== 'string' ||
          user.email.toLowerCase() !== pilotEmail.toLowerCase() || !user.email_confirmed_at)) return null;
      return {userId: user.id, aal: parseValidatedAal2(bearer, user.id) ? 'aal2' : null};
    },
    async lookupRole({bearer, userId, projectId}) {
      if (!parseValidatedAal2(bearer, userId)) return null;
      const query = new URLSearchParams({
        select: 'role', project_id: 'eq.' + projectId, user_id: 'eq.' + userId, limit: '2',
      });
      const rows = await read('/rest/v1/memberships?' + query, bearer);
      return Array.isArray(rows) && rows.length === 1 ? rows[0]?.role ?? null : null;
    },
  };
}
