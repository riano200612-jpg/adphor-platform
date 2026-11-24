import {createCalendarOAuthRoutes} from './routes.mjs';
import {createCalendarOAuthTransactionCipher} from './transaction-cipher.mjs';
import {createCalendarOAuthTransactionStore} from './transaction-store.mjs';
import {createCalendarOAuthPendingStore} from './pending-store.mjs';
import {createCalendarOAuthConnectionStore} from './connection-store.mjs';
import {createGoogleCalendarAuthorization} from './google-authorization.mjs';
import {createCalendarOAuthConnectionReader} from './connection-reader.mjs';
import {createCalendarOAuthMeetingStore} from './meeting-store.mjs';
import {createGoogleCalendarEventService} from './google-calendar-events.mjs';

// Composition point for the existing QA runtime. The connection must use the
// restricted database login and the encryption key must be supplied by the host.
export async function createCalendarOAuthRuntime({database, encryptionKey, access, supabase, google}) {
  if (typeof database?.query !== 'function' || typeof database?.transaction !== 'function') throw new Error('OAuth private database unavailable.');
  const cipher = await createCalendarOAuthTransactionCipher(encryptionKey);
  const storage = {database, ...cipher};
  const connectionReader=createCalendarOAuthConnectionReader({database,open:cipher.open});
  const meetingStore=createCalendarOAuthMeetingStore({database});
  const calendarEvents=createGoogleCalendarEventService({
    clientId:google.clientId,clientSecret:google.clientSecret,
    getConnection:actor=>connectionReader(actor,async connection=>connection),eventStore:meetingStore,
  });
  return createCalendarOAuthRoutes({
    access, supabase: {...supabase, pilotEmail: google.expectedEmail}, clientId: google.clientId,
    store: createCalendarOAuthTransactionStore(storage),
    pending: createCalendarOAuthPendingStore(storage),
    createMeeting:calendarEvents.createMeeting,refreshMeeting:calendarEvents.refreshMeeting,
    meetingStore,pilotProjectId:google.pilotProjectId,
    completeAuthorization: createGoogleCalendarAuthorization({
      ...google, saveConnection: createCalendarOAuthConnectionStore(storage),
    }),
  });
}
