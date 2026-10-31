import test from 'node:test';import assert from 'node:assert/strict';
import {legacyMeetingCalendar} from '../src/js/services/legacy-meeting-calendar.js';
const mk=(project_id,id,day,clock)=>({project_id,legacy_id:id,event_date:day,start_local:clock,type:'Consejo',specification:'Ordinario',modality:'Virtual',status:'Confirmado',source:'jose_reuniones_sheet',read_only:true});
test('calendar includes only source-authorized meetings in selected property and range',()=>{
 const rows=[mk('p1','a','2026-11-12','18:00'),mk('p2','b','2026-11-12','18:00'),mk('p1','c','2026-12-02','18:00'),mk('p1','d','2026-11-12','09:00')];
 const output=legacyMeetingCalendar(rows,{projectId:'p1',from:'2026-11-01',to:'2026-11-30'});
 assert.deepEqual(output.map(m=>m.id),['d','a']);
 assert.ok(output.every(m=>m.read_only));
 assert.equal(JSON.stringify(output).includes('p2'),false);
});
test('calendar rejects invalid scope',()=>{
 assert.throws(()=>legacyMeetingCalendar([],{projectId:'',from:'2026-11-01',to:'2026-11-30'}));
 assert.throws(()=>legacyMeetingCalendar([],{projectId:'p1',from:'2026-12-01',to:'2026-11-01'}));
});
