import test from 'node:test';
import assert from 'node:assert/strict';
import {listDemoMeetings,scheduleDemoMeeting,cancelDemoMeeting} from '../src/js/services/demo-calendar.js';
const data=new Map();
globalThis.localStorage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)};
const future=Date.now()+72*3600000;
const slot=(offset=0)=>({title:'Reunión gerencial',start:new Date(future+offset).toISOString(),end:new Date(future+offset+3600000).toISOString(),priority:'alto',management:true});
test('meeting agenda is isolated by project and persists in browser fixture',()=>{
 const r=scheduleDemoMeeting('prop-a',slot());assert.equal(r.management,true);
 assert.equal(listDemoMeetings('prop-a').length,1);assert.equal(listDemoMeetings('prop-b').length,0);
 assert.throws(()=>scheduleDemoMeeting('prop-a',slot(600000)),/Conflicto/);
 assert.equal(cancelDemoMeeting('prop-a',r.id).status,'cancelled');
 assert.equal(scheduleDemoMeeting('prop-a',slot(600000)).status,'scheduled');
});
test('meeting within 24h is not automatically approved',()=>{
 const r=scheduleDemoMeeting('prop-b',{...slot(),start:new Date(Date.now()+3600000).toISOString(),end:new Date(Date.now()+7200000).toISOString()});
 assert.equal(r.status,'pending_management');
});
