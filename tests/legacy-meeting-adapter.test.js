import test from 'node:test';import assert from 'node:assert/strict';import {prepareLegacyMeetingRows} from '../src/js/services/legacy-meeting-adapter.js';
const headers=['ID_Reunion','Copropiedad','Tipo','Fecha_Evento','Hora Inicio Estimada','Estado','Correo','linkMeet','ID_Evento_Calendario'];
test('legacy meeting adapter filters unmapped property and suppresses private metadata',()=>{
 const {meetings,rejected}=prepareLegacyMeetingRows([headers,['R01','Porto','Consejo','2026-11-10','09:00','Confirmado','secret@example.test','https://meet.google.com/abc','external-id'],['R02','Other','Asamblea','2026-11-10','10:00','Pendiente','other@example.test']],{projectIdByLegacyName:{Porto:'qa-porto'}});
 assert.equal(meetings.length,1);assert.equal(rejected.length,1);assert.equal(meetings[0].project_id,'qa-porto');
 assert.equal(JSON.stringify(meetings).includes('@'),false);
 assert.equal(JSON.stringify(meetings).includes('meet.google'),false);
 assert.equal(meetings[0].read_only,true);
});
test('rejects malformed date and duplicate',()=>{
 const rows=[headers,['R1','Porto','Consejo','2026-02-30','09:00','Confirmado'],['R1','Porto','Consejo','2026-11-10','09:00','Confirmado'],['R1','Porto','Consejo','2026-11-10','09:00','Confirmado']];
 const x=prepareLegacyMeetingRows(rows,{projectIdByLegacyName:{Porto:'qa-porto'}});
 assert.equal(x.meetings.length,1);assert.equal(x.rejected.length,2);
});

test('accepts Colombian date and AM/PM formats from Sheets without time-zone conversion',()=>{
 const rows=[headers,['R-3','Porto','Consejo','11/11/2026','7:30 p. m.','Confirmado'],['R-4','Porto','Asamblea','2026-11-12','12:00 AM','Pendiente']];
 // A localized AM/PM suffix should not be silently guessed if unsupported.
 const r=prepareLegacyMeetingRows(rows,{projectIdByLegacyName:{Porto:'qa-porto'}});
 assert.equal(r.meetings.find(x=>x.legacy_id==='R-4').start_local,'00:00');
 assert.equal(r.rejected.length,1);
});
test('normalizes day-first calendar dates',()=>{
 const r=prepareLegacyMeetingRows([headers,['R-5','Porto','Comité','13/11/2026','9:05 pm','Confirmado']],{projectIdByLegacyName:{Porto:'qa-porto'}});
 assert.equal(r.meetings[0].event_date,'2026-11-13');
 assert.equal(r.meetings[0].start_local,'21:05');
});
