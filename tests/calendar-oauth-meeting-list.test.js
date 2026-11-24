import assert from 'node:assert/strict';
import test from 'node:test';
import {QA_URL} from '../qa/security/private-worker-bootstrap-core.mjs';
import {createCalendarMeetingList,listMeetingsPath} from '../backend/src/calendar-oauth/meeting-list.mjs';

test('lists only meetings in the authenticated pilot project after Access/AAL2/membership checks',async()=>{
  let listed=0;
  const handler=createCalendarMeetingList({
    pilotProjectId:'source-28',verifyAccess:async()=>({subject:'access'}),
    verifySession:async()=>({userId:'u1',aal:'aal2'}),lookupRole:async()=> 'admin',
    meetingStore:{list:async({actor})=>{listed++;assert.deepEqual(actor,{userId:'u1',projectId:'source-28'});return [{googleEventId:'event_12345',meetLink:'https://meet.google.com/abc-defg-hij'}];}},
  });
  const response=await handler(new Request(QA_URL+listMeetingsPath+'?project=source-28',{method:'POST',headers:{Origin:QA_URL,Authorization:'Bearer session'}}));
  assert.equal(response.status,200);
  assert.equal((await response.json()).meetings[0].googleEventId,'event_12345');
  assert.equal(listed,1);
  const denied=await createCalendarMeetingList({
    pilotProjectId:'source-28',verifyAccess:async()=>({subject:'access'}),
    verifySession:async()=>({userId:'u1',aal:'aal2'}),lookupRole:async()=> null,meetingStore:{list:async()=>[]},
  })(new Request(QA_URL+listMeetingsPath+'?project=source-29',{method:'POST',headers:{Origin:QA_URL,Authorization:'Bearer session'}}));
  assert.equal(denied.status,403);
});

test('accepts null and zero-byte request bodies, but rejects a payload byte',async()=>{
 let listed=0;const handler=createCalendarMeetingList({pilotProjectId:'source-28',verifyAccess:async()=>({subject:'access'}),
  verifySession:async()=>({userId:'u1',aal:'aal2'}),lookupRole:async()=> 'admin',meetingStore:{list:async()=>{listed++;return [];}}});
 const headers={Origin:QA_URL,Authorization:'Bearer session'};
 for(const body of [null,new ReadableStream({start(controller){controller.close();}})]){
  const result=await handler(new Request(QA_URL+listMeetingsPath+'?project=source-28',{method:'POST',headers,body,duplex:'half'}));
  assert.equal(result.status,200);
 }
 const payload=await handler(new Request(QA_URL+listMeetingsPath+'?project=source-28',{method:'POST',headers,duplex:'half',
  body:new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode('x'));controller.close();}})}));
 assert.equal(payload.status,400);assert.equal(listed,2);
});
