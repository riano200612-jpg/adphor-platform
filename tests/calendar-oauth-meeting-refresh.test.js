import assert from 'node:assert/strict';
import test from 'node:test';
import {QA_URL} from '../qa/security/private-worker-bootstrap-core.mjs';
import {createCalendarMeetingRefresh,refreshMeetingPath} from '../backend/src/calendar-oauth/meeting-refresh.mjs';
const payload={idempotencyKey:'a'.repeat(64)};
function request(body=payload,project='source-28'){return new Request(QA_URL+refreshMeetingPath+'?project='+project,{method:'POST',
 headers:{Origin:QA_URL,Authorization:'Bearer session'},body:JSON.stringify(body)});}
test('Meet refresh keeps Access, AAL2, membership and pilot scope checks',async()=>{
 let calls=0;const deps={pilotProjectId:'source-28',verifyAccess:async()=>({subject:'access'}),
 verifySession:async()=>({userId:'u1',aal:'aal2'}),lookupRole:async()=> 'admin',
 refreshMeeting:async({actor,idempotencyKey})=>{calls++;assert.deepEqual(actor,{userId:'u1',projectId:'source-28'});assert.equal(idempotencyKey,payload.idempotencyKey);
 return {projectId:'source-28',status:'created',googleEventId:'0123456789abcdef0123456789abcdef',
 meetLink:'https://meet.google.com/abc-defg-hij'};}};
 assert.equal((await createCalendarMeetingRefresh({...deps,verifyAccess:async()=>null})(request())).status,403);
 assert.equal((await createCalendarMeetingRefresh({...deps,verifySession:async()=>({userId:'u1',aal:'aal1'})})(request())).status,403);
 assert.equal((await createCalendarMeetingRefresh({...deps,lookupRole:async()=>null})(request())).status,403);
 assert.equal((await createCalendarMeetingRefresh(deps)(request(payload,'source-29'))).status,403);
 assert.equal((await createCalendarMeetingRefresh(deps)(request({idempotencyKey:'bad'}))).status,400);
 assert.equal((await createCalendarMeetingRefresh(deps)(request())).status,200);assert.equal(calls,1);
});
