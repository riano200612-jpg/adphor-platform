import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareManualGoogleDraft,buildManualCalendarIcs} from '../src/js/services/manual-google-handoff.js';
const now=Date.parse('2026-11-18T14:00:00Z');
const fields={title:'Consejo · ADPHOR',start:'2026-11-20T14:00:00.000Z',end:'2026-11-20T15:30:00.000Z',now};
const draft=()=>prepareManualGoogleDraft(fields);
test('manual Calendar handoff uses TEMPLATE only; Bogotá and UTC range are explicit',()=>{
 const d=draft(),url=new URL(d.url),p=url.searchParams;
 assert.equal(url.origin,'https://calendar.google.com');
 assert.equal(p.get('action'),'TEMPLATE');
 assert.equal(p.get('dates'),'20261120T140000Z/20261120T153000Z');
 assert.equal(p.get('ctz'),'America/Bogota');
 assert.equal(p.get('stz'),'America/Bogota');
 assert.equal(p.get('etz'),'America/Bogota');
 assert.match(p.get('text'),/POR CONFIRMAR/);
 assert.match(p.get('details'),/seleccionar el calendario correcto/);
 assert.doesNotMatch(d.url,/refresh_token|access_token|client_secret|attendees=/i);
});
test('rejects invalid subjects, start/end timestamps, bounds and insufficient lead time',()=>{
 const cases=[{...fields,title:'  '},{...fields,start:'2026-11-20T09:00:00'},
  {...fields,end:fields.start},{...fields,end:'2026-11-20T14:14:00.000Z'},
  {...fields,end:'2026-11-21T03:00:00.000Z'},
  {...fields,start:'2026-11-18T15:00:00.000Z',end:'2026-11-18T16:00:00.000Z'},
  {...fields,title:'X'.repeat(201)},{...fields,now:NaN},
  {...fields,start:'2026-11-31T14:00:00.000Z'}];
 for(const item of cases)assert.throws(()=>prepareManualGoogleDraft(item));
});
test('permits exact 24 hour lead time and 15 minute minimum',()=>{
 const d=prepareManualGoogleDraft({...fields,start:'2026-11-19T14:00:00.000Z',end:'2026-11-19T14:15:00.000Z'});
 assert.equal(new URL(d.url).searchParams.get('dates'),'20261119T140000Z/20261119T141500Z');
});
test('ICS is tentative, read-only, non-inviting, UTC and RFC5545-formatted',()=>{
 const ics=buildManualCalendarIcs({draft:draft(),uid:'12345678-abcd',now});
 assert.match(ics,/BEGIN:VCALENDAR\r\nVERSION:2.0/);
 assert.match(ics,/DTSTART:20261120T140000Z/);
 assert.match(ics,/DTEND:20261120T153000Z/);
 assert.match(ics,/STATUS:TENTATIVE/);
 assert.doesNotMatch(ics,/ATTENDEE:|ORGANIZER:|BEGIN:VALARM/);
 assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
});
test('ICS escapes newline and punctuation injection in the subject',()=>{
 const d=prepareManualGoogleDraft({...fields,title:'Consejo, reunión; alerta\nBEGIN:VALARM'});
 const ics=buildManualCalendarIcs({draft:d,uid:'12345678-abcd',now});
 assert.match(ics,/Consejo\\, reunión\\; alerta\\nBEGIN:VALARM/);
 assert.doesNotMatch(ics,/\r\nBEGIN:VALARM/);
});
test('ICS folds long multibyte UTF-8 fields at 75 bytes',()=>{
 const d=prepareManualGoogleDraft({...fields,title:'Reunión 😃 '.repeat(17)});
 const ics=buildManualCalendarIcs({draft:d,uid:'12345678-abcd',now});
 for(const line of ics.split('\r\n').filter(Boolean))
  assert.ok(Buffer.byteLength(line,'utf8')<=75);
});
test('ICS fails closed on malformed draft or UID',()=>{
 assert.throws(()=>buildManualCalendarIcs({draft:null,uid:'12345678-abcd',now}),/Borrador/);
 assert.throws(()=>buildManualCalendarIcs({draft:draft(),uid:'../../foo',now}),/Identificador/);
});

test('handoff prepopulates authorized business context and Google Meet guidance without attendee details',()=>{
 const d=prepareManualGoogleDraft({...fields,property:'Edificio QA Azul',meetingType:'Consejo',
  modality:'Mixta'});
 const params=new URL(d.url).searchParams;
 assert.match(params.get('details'),/Copropiedad: Edificio QA Azul/);
 assert.match(params.get('details'),/Tipo de reunión: Consejo/);
 assert.match(params.get('details'),/Modalidad: Mixta/);
 assert.match(params.get('details'),/agrega Google Meet/);
 assert.match(params.get('details'),/no importes el archivo ICS/);
 assert.doesNotMatch(d.url,/attendees|guest|email|password|refresh_token/i);
 const ics=buildManualCalendarIcs({draft:d,uid:'12345678-abcd',now});
 assert.match(ics.replace(/\r\n /g,''),/Copropiedad: Edificio QA Azul/);
 assert.match(ics,/STATUS:TENTATIVE/);
 assert.doesNotMatch(ics,/ATTENDEE:/);
});
test('presencial meetings do not instruct Google Meet creation',()=>{
 const d=prepareManualGoogleDraft({...fields,property:'ADPHOR',modality:'Presencial'});
 assert.doesNotMatch(new URL(d.url).searchParams.get('details'),/agrega Google Meet/);
});
test('context injection, oversized properties and unknown modalities fail closed',()=>{
 for(const patch of [
  {property:'QA\nATTENDEE:evil@example.org'},
  {property:'X'.repeat(161)},
  {meetingType:'Consejo\r\n'},
  {modality:'auto_create_event'}
 ]){
  assert.throws(()=>prepareManualGoogleDraft({...fields,...patch}));
 }
});
