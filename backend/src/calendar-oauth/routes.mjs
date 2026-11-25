import {createCalendarAccessVerifier} from './access.mjs';
import {createCalendarOAuthCallback} from './callback.mjs';
import {createCalendarOAuthFinalize} from './finalize.mjs';
import {createCalendarOAuthStart} from './start.mjs';
import {createCalendarMeetingCreate} from './meeting-create.mjs';
import {createCalendarMeetingList} from './meeting-list.mjs';
import {createCalendarMeetingRefresh} from './meeting-refresh.mjs';
import {createCalendarSupabaseAuthorization} from './supabase-authorization.mjs';

// The QA runtime must supply the server-only transaction store, staging
// adapter and the audience of the exact Access application serving these URLs.
export function createCalendarOAuthRoutes({access, supabase, clientId, store, pending, completeAuthorization, createMeeting, refreshMeeting, meetingStore, pilotProjectId}) {
  if (typeof clientId !== 'string' || !clientId || typeof store?.save !== 'function' ||
      typeof store?.consume !== 'function' || typeof pending?.stage !== 'function' ||
      typeof pending?.consume !== 'function' || typeof completeAuthorization !== 'function') {
    throw new Error('Calendar OAuth QA runtime dependencies are not configured.');
  }

  const verifyAccess = createCalendarAccessVerifier(access);
  const identity = createCalendarSupabaseAuthorization(supabase);
  const routes = {
    start: createCalendarOAuthStart({verifyAccess, ...identity, clientId, store, pilotProjectId}),
    callback: createCalendarOAuthCallback({verifyAccess, store, stageAuthorization: pending.stage}),
    finalize: createCalendarOAuthFinalize({verifyAccess, ...identity, pending, completeAuthorization, pilotProjectId}),
  };
  if (typeof createMeeting === 'function' && typeof pilotProjectId === 'string') {
    routes.createMeeting = createCalendarMeetingCreate({
      verifyAccess, ...identity, createMeeting, pilotProjectId,
    });
    routes.listMeetings = createCalendarMeetingList({
      verifyAccess, ...identity, meetingStore, pilotProjectId,
    });
    if(typeof refreshMeeting==='function')routes.refreshMeeting=createCalendarMeetingRefresh({
      verifyAccess,...identity,refreshMeeting,pilotProjectId,
    });
  }
  return routes;
}
