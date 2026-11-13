import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectQaRegisteredConflicts} from '../src/js/services/qa-register-conflicts.js';
const start='2026-11-16T10:00:00-05:00', end='2026-11-16T11:00:00-05:00';
const meeting={id:'qa-1',project_id:'p1',source_status:'Confirmada',is_calendar_verified:true,start_at:'2026-11-16T11:20:00-05:00',end_at:'2026-11-16T12:20:00-05:00'};
const run=(rows,override={})=>inspectQaRegisteredConflicts(rows,{projectId:'p1',start,end,...override});
test('QA register detects 30-minute boundary conflicts but cannot claim Google availability',()=>{
 assert.deepEqual(run([meeting]),{conflicts:1,examined:1,source:'registered_qa_only'});
 assert.equal(run([{...meeting,start_at:'2026-11-16T11:30:00-05:00'}]).conflicts,0);
 assert.equal(run([{...meeting,start_at:'2026-11-16T11:29:59-05:00'}]).conflicts,1);
 assert.equal(run([]).conflicts,0);
 assert.equal(run([]).source,'registered_qa_only');
});
test('QA register fails closed on foreign project, unverifiable source, bad dates or truncated page',()=>{
 for(const rows of [
  [{...meeting,project_id:'p2'}],[{...meeting,is_calendar_verified:false}],
  [{...meeting,source_status:'Pendiente'}],[{...meeting,start_at:'2026-11-16T10:00:00'}],
  [{...meeting,end_at:'bad'}],Array(500).fill(meeting),null,{}
 ])assert.throws(()=>run(rows));
 for(const override of [{projectId:''},{start:'2026-11-16T10:00:00'},{end:start},{end:'2026-11-17T12:00:00-05:00'}])
  assert.throws(()=>run([],override));
});
