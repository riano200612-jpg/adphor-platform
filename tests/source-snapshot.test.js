import test from 'node:test';
import assert from 'node:assert/strict';
import {ADPHOR_SOURCE_SNAPSHOT} from '../src/js/ui-source-snapshot.js';
test('verified real client aggregate snapshot contains no personal fields or appointments',()=>{
 assert.equal(ADPHOR_SOURCE_SNAPSHOT.observedAt,'2026-11-03');
 assert.deepEqual(ADPHOR_SOURCE_SNAPSHOT.figures.map(x=>x.value),[44,684,29,55,368]);
 const data=JSON.stringify(ADPHOR_SOURCE_SNAPSHOT);
 for(const term of ['@','PIN','password','meeting_id','source_record_id','documento_personal'])assert.equal(data.includes(term),false);
 assert.match(data,/no.*migradas|todavía sin homologar/i);
});
