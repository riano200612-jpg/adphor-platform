import assert from 'node:assert/strict';
import test from 'node:test';
import {QA_URL} from '../qa/security/private-worker-bootstrap-core.mjs';
import {createCalendarMeetingCreate,createMeetingPath} from '../backend/src/calendar-oauth/meeting-create.mjs';

function request(payload,options={}) {
  return new Request(QA_URL+createMeetingPath+'?project=source-28',{
    method:'POST',headers:{Origin:QA_URL,Authorization:'Bearer session',...options.headers},
    body:payload===null?null:JSON.stringify(payload),
  });
}
const payload={confirmed:true,summary:'[ADPHOR QA] Reunión QA',description:'Prueba',start:'2026-12-01T10:00:00-05:00',end:'2026-12-01T10:30:00-05:00'};

test('requires Access, Supabase AAL2, allowed membership, explicit confirmation and exact pilot scope',async()=>{
  let created=0;
  const deps={pilotProjectId:'source-28',verifyAccess:async()=>({subject:'access'}),verifySession:async()=>({userId:'u1',aal:'aal2'}),lookupRole:async()=> 'admin',
    createMeeting:async({actor,meeting})=>{created++;assert.deepEqual(actor,{userId:'u1',projectId:'source-28'});assert.equal(meeting.attendees,undefined);return {status:'created',googleEventId:'event_12345',meetLink:'https://meet.google.com/abc-defg-hij'};}};
  assert.equal((await createCalendarMeetingCreate({...deps,verifyAccess:async()=>null})(request(payload))).status,403);
  assert.equal((await createCalendarMeetingCreate({...deps,verifySession:async()=>({userId:'u1',aal:'aal1'})})(request(payload))).status,403);
  assert.equal((await createCalendarMeetingCreate({...deps,lookupRole:async()=>null})(request(payload))).status,403);
  assert.equal((await createCalendarMeetingCreate(deps)(request({...payload,confirmed:false}))).status,400);
  assert.equal((await createCalendarMeetingCreate(deps)(request({...payload,attendees:[]}))).status,400);
  assert.equal((await createCalendarMeetingCreate(deps)(new Request(QA_URL+createMeetingPath+'?project=other',{method:'POST',headers:{Origin:QA_URL,Authorization:'Bearer session'},body:JSON.stringify(payload)}))).status,403);
  const ok=await createCalendarMeetingCreate(deps)(request(payload));
  assert.equal(ok.status,201);
  assert.equal(created,1);
  const pending=await createCalendarMeetingCreate({...deps,createMeeting:async()=>({
    status:'reconciling',projectId:'source-28',googleEventId:'0123456789abcdef0123456789abcdef',
    idempotencyKey:'a'.repeat(64),meetLink:null,summary:'[ADPHOR QA] Reunión QA',
    start:'2026-12-01T15:00:00.000Z',end:'2026-12-01T15:30:00.000Z'})})(request(payload));
  assert.equal(pending.status,202);assert.equal((await pending.json()).status,'reconciling');
  const rejected=await createCalendarMeetingCreate({...deps,createMeeting:async()=>({status:'failed'})})(request(payload));
  assert.equal(rejected.status,422);assert.deepEqual(await rejected.json(),{code:'CAL_GOOGLE_REJECTED'});
});
