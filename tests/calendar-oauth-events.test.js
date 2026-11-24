import assert from 'node:assert/strict';
import test from 'node:test';
import {createGoogleCalendarEventService} from '../backend/src/calendar-oauth/google-calendar-events.mjs';

const actor = {userId: 'qa-user', projectId: 'source-28'};
const meeting = {
  idempotencyKey: 'qa-meeting-request-0001',
  summary: 'Reunión piloto ADPHOR',
  description: 'Evento de prueba privado.',
  start: '2026-12-01T10:00:00-05:00',
  end: '2026-12-01T10:30:00-05:00',
  timeZone: 'America/Bogota',
};

test('creates a private event with real Meet response shape, no guests, no updates, then persists it', async () => {
  const calls = [];
  let persisted;
  const service = createGoogleCalendarEventService({
    clientId: 'qa-client', clientSecret: 'qa-secret',
    async getConnection(receivedActor) {
      assert.deepEqual(receivedActor, actor);
      return {refreshToken: 'encrypted-store-decoded-in-service'};
    },
    eventStore: {
      async claim() { return {status: 'claimed'}; },
      async find() { return null; },
      async complete(value) { persisted = value.event; },
    },
    async transport(url, options) {
      calls.push({url: String(url), options});
      if (url === 'https://oauth2.googleapis.com/token') {
        return Response.json({access_token: 'qa-access', token_type: 'Bearer'});
      }
      if (String(url).startsWith('https://www.googleapis.com/calendar/v3/calendars/primary/events?privateExtendedProperty=')) {
        return Response.json({items: []});
      }
      const body = JSON.parse(options.body);
      assert.equal(body.attendees, undefined);
      assert.equal(body.visibility, 'private');
      assert.equal(options.redirect, 'manual');
      assert.equal(new URL(url).searchParams.get('conferenceDataVersion'), '1');
      assert.equal(new URL(url).searchParams.get('sendUpdates'), 'none');
      return Response.json({
        id: 'event_12345', hangoutLink: 'https://meet.google.com/abc-defg-hij',
      }, {status: 200});
    },
  });
  const result = await service({actor, meeting});
  assert.equal(result.status, 'created');
  assert.equal(result.googleEventId, 'event_12345');
  assert.equal(result.meetLink, 'https://meet.google.com/abc-defg-hij');
  assert.deepEqual(persisted, result);
  assert.equal(calls.length, 3);
});

test('rejects invitations and malformed meeting input before contacting Google', async () => {
  let calls = 0;
  const service = createGoogleCalendarEventService({
    clientId: 'qa-client', clientSecret: 'qa-secret',
    getConnection: async () => ({refreshToken: 'x'}),
    eventStore: {claim: async () => ({status: 'claimed'}), find: async () => null, complete: async () => {}},
    async transport() { calls++; return Response.json({}); },
  });
  await assert.rejects(service({actor, meeting: {...meeting, attendees: [{email: 'external@example.test'}]}}),
    /Invalid Google Calendar meeting request/);
  assert.equal(calls, 0);
});

test('fails closed when Google returns no authentic Meet link', async () => {
  const service = createGoogleCalendarEventService({
    clientId: 'qa-client', clientSecret: 'qa-secret',
    getConnection: async () => ({refreshToken: 'x'}),
    eventStore: {claim: async () => ({status: 'claimed'}), find: async () => null, complete: async () => {}},
    async transport(url) {
      if (url === 'https://oauth2.googleapis.com/token') return Response.json({access_token: 'a', token_type: 'Bearer'});
      if (String(url).includes('privateExtendedProperty=')) return Response.json({items: []});
      return Response.json({id: 'event_12345'});
    },
  });
  const result = await service({actor, meeting});
  assert.equal(result.status, 'meet_pending');
  assert.equal(result.meetLink, null);
});
