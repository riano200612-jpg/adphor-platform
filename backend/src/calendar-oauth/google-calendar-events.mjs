const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_EVENTS_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
const encoder = new TextEncoder();

function validActor(actor) {
  return typeof actor?.userId === 'string' && actor.userId.length > 0 && actor.userId.length <= 255 &&
    typeof actor?.projectId === 'string' && /^[a-z0-9][a-z0-9-]{0,99}$/.test(actor.projectId);
}

function validRequest(input) {
  const dateTime = value => typeof value === 'string' &&
    /^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d{1,3})?)?(?:Z|[+-]\d\d:\d\d)$/.test(value) &&
    Number.isFinite(Date.parse(value));
  return typeof input?.idempotencyKey === 'string' &&
    /^[a-z0-9_-]{20,128}$/.test(input.idempotencyKey) &&
    typeof input?.summary === 'string' && input.summary.trim().length >= 3 &&
    input.summary.trim().length <= 200 &&
    typeof input?.description === 'string' && input.description.length <= 5000 &&
    dateTime(input?.start) && dateTime(input?.end) &&
    Date.parse(input.end) > Date.parse(input.start) &&
    Date.parse(input.end) - Date.parse(input.start) <= 12 * 60 * 60 * 1000 &&
    (input.timeZone === undefined || (typeof input.timeZone === 'string' && input.timeZone.length <= 64)) &&
    input.attendees === undefined;
}

function safeEvent(event) {
  const id = event?.id;
  const meet = event?.hangoutLink ??
    event?.conferenceData?.entryPoints?.find(entry => entry?.entryPointType === 'video')?.uri;
  if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{5,1024}$/.test(id)) {
    throw new Error('Google Calendar returned an invalid event.');
  }
  const meetUrl = typeof meet === 'string' ? new URL(meet) : null;
  const meetLink = meetUrl?.protocol === 'https:' && meetUrl.hostname === 'meet.google.com' ? meetUrl.href : null;
  return {googleEventId: id, meetLink, status: meetLink ? 'created' : 'meet_pending'};
}

async function idForMeetRequest(value) {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)));
  return [...digest].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

// This server-only primitive is deliberately dependency-injected. The Pages
// route must authorize Access, Supabase AAL2, current membership and pilot scope
// before invoking it. No attendees are accepted, and Google sends no updates.
export function createGoogleCalendarEventService({
  clientId, clientSecret, getConnection, eventStore, transport = fetch,
}) {
  if (![clientId, clientSecret].every(value => typeof value === 'string' && value.length > 0) ||
      typeof getConnection !== 'function' ||
      typeof eventStore?.claim !== 'function' || typeof eventStore?.find !== 'function' ||
      typeof eventStore?.complete !== 'function') {
    throw new Error('Google Calendar event service is not configured.');
  }

  async function request(url, options) {
    const response = await transport(url, {
      ...options, redirect: 'manual', cache: 'no-store', signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error('Google Calendar request failed.');
    return response.json();
  }

  async function accessToken(actor) {
    const connection = await getConnection(actor);
    if (typeof connection?.refreshToken !== 'string' || !connection.refreshToken) {
      throw new Error('Google Calendar connection is unavailable.');
    }
    const token = await request(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: {'Content-Type': 'application/x-www-form-urlencoded'},
      body: new URLSearchParams({
        client_id: clientId, client_secret: clientSecret,
        refresh_token: connection.refreshToken, grant_type: 'refresh_token',
      }),
    });
    if (typeof token?.access_token !== 'string' || !token.access_token ||
        token.access_token.length > 8192 || token.token_type?.toLowerCase() !== 'bearer') {
      throw new Error('Google Calendar authorization is unavailable.');
    }
    return token.access_token;
  }

  async function findOnGoogle(token, idempotencyKey) {
    const url = new URL(GOOGLE_EVENTS_URL);
    url.searchParams.set('privateExtendedProperty', 'adphorRequestId=' + idempotencyKey);
    url.searchParams.set('showDeleted', 'false');
    url.searchParams.set('maxResults', '2');
    const result = await request(url.href, {headers: {Authorization: 'Bearer ' + token}});
    if (!Array.isArray(result?.items) || result.items.length > 1) {
      throw new Error('Google Calendar idempotency check failed.');
    }
    return result.items.length ? result.items[0] : null;
  }

  return async function createMeeting({actor, meeting}) {
    if (!validActor(actor) || !validRequest(meeting)) {
      throw new Error('Invalid Google Calendar meeting request.');
    }
    const claim = await eventStore.claim({actor, idempotencyKey: meeting.idempotencyKey});
    if (claim?.status === 'complete' && claim.event) return claim.event;
    if (claim?.status !== 'claimed') throw new Error('Google Calendar request is already in progress.');

    const token = await accessToken(actor);
    const recovered = await findOnGoogle(token, meeting.idempotencyKey);
    const event = recovered ?? await request(
      GOOGLE_EVENTS_URL + '?conferenceDataVersion=1&sendUpdates=none',
      {
        method: 'POST',
        headers: {'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json'},
        body: JSON.stringify({
          summary: meeting.summary.trim(),
          description: meeting.description,
          start: {dateTime: meeting.start, timeZone: meeting.timeZone ?? 'America/Bogota'},
          end: {dateTime: meeting.end, timeZone: meeting.timeZone ?? 'America/Bogota'},
          visibility: 'private',
          extendedProperties: {private: {adphorRequestId: meeting.idempotencyKey}},
          conferenceData: {createRequest: {
            requestId: await idForMeetRequest(meeting.idempotencyKey),
            conferenceSolutionKey: {type: 'hangoutsMeet'},
          }},
        }),
      },
    );
    const result = safeEvent(event);
    const persisted = {
      ...result, userId: actor.userId, projectId: actor.projectId,
      idempotencyKey: meeting.idempotencyKey, summary: meeting.summary.trim(),
      start: meeting.start, end: meeting.end,
    };
    await eventStore.complete({actor, event: persisted});
    return persisted;
  };
}
