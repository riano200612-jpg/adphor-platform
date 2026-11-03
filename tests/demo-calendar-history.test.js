import test from 'node:test';
import assert from 'node:assert/strict';
import {scheduleDemoMeeting,decideDemoMeeting,historyDemoMeeting,cancelDemoMeeting} from '../src/js/services/demo-calendar.js';
const storage=new Map();
globalThis.localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)};
test('history includes creation, reschedule and cancellation, scoped to one property',()=>{
 const start=Date.now()+72*3600000;
 const f={title:'Consejo',start:new Date(start).toISOString(),end:new Date(start+3600000).toISOString()};
 const a=scheduleDemoMeeting('history-a',f);
 scheduleDemoMeeting('history-a',{...f,id:a.id,start:new Date(start+7200000).toISOString(),end:new Date(start+10800000).toISOString()});
 assert.deepEqual(historyDemoMeeting('history-a',a.id).map(h=>h.action),['created','rescheduled']);
 cancelDemoMeeting('history-a',a.id);
 assert.equal(historyDemoMeeting('history-a',a.id).at(-1).action,'cancelled');
 assert.throws(()=>historyDemoMeeting('history-b',a.id),/encontrada/);
});
test('a late booking requires demo managerial decision and cannot be approved twice',()=>{
 const start=Date.now()+3600000;
 const item=scheduleDemoMeeting('review-a',{title:'Gerencia',start:new Date(start).toISOString(),end:new Date(start+1800000).toISOString()});
 assert.equal(item.status,'pending_management');
 assert.throws(()=>decideDemoMeeting('review-a',item.id,{role:'viewer',decision:'approve',reason:'Validado'}),/reservada/);
 assert.throws(()=>decideDemoMeeting('review-a',item.id,{role:'management',decision:'approve'}),/motivo/);
 const decided=decideDemoMeeting('review-a',item.id,{role:'management',decision:'approve',reason:'Revisión QA'});
 assert.equal(decided.status,'scheduled');
 assert.equal(historyDemoMeeting('review-a',item.id).at(-1).action,'approved');
 assert.throws(()=>decideDemoMeeting('review-a',item.id,{role:'management',decision:'approve',reason:'duplicado'}),/pendiente/);
});
