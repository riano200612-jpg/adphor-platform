import test from 'node:test';import assert from 'node:assert/strict';
import {buildClientMeetingTitle,meetingColorCategory,parseClientLocalDateTime} from '../src/js/services/client-meeting-mapping.js';
test('preserve client council and pre-assembly naming',()=>{
 assert.match(buildClientMeetingTitle({type:'Consejo',subType:'Pre-Asamblea',specification:'Ordinario',property:'Porto Castello',modality:'Presencial'}),/Pre-Asamblea \(Consejo\)/);
 assert.match(buildClientMeetingTitle({type:'Consejo',property:'ADPHOR',modality:'Presencial'}),/ADPHOR/);
});
test('colors reflect type and confirmed state',()=>{assert.equal(meetingColorCategory('Consejo','Confirmada'),'pale_blue');assert.equal(meetingColorCategory('Comité','Pendiente'),'gray')});
test('24-hour time parser does not shift 13:00 to 1 AM',()=>{assert.equal(parseClientLocalDateTime('2026-11-10','13:00').getHours(),13);assert.equal(parseClientLocalDateTime('2026-11-10','12:00 am').getHours(),0);assert.throws(()=>parseClientLocalDateTime('2026-02-30','18:00'))});
