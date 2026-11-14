import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadVerifiedAgenda,validateVerifiedQaMeetingRows,verifiedAgendaUiError,AGENDA_GENERIC_LOAD_ERROR}
 from '../src/js/services/verified-agenda.js';

const row=(id='m1',project_id='p1')=>({
 id,project_id,title:'Consejo autorizado',kind:'Consejo',
 source_status:'Confirmada',is_calendar_verified:true,
 start_at:'2026-11-15T11:00:00-05:00',end_at:'2026-11-15T12:00:00-05:00'
});

test('Verified agenda source accepts valid rows, sorts by strict timestamps and never mutates them',()=>{
 const late=row('late'),early={...row('early'),start_at:'2026-11-15T09:00:00-05:00',
  end_at:'2026-11-15T09:30:00-05:00'};
 const rows=[late,early],snapshot=structuredClone(rows);
 const validated=validateVerifiedQaMeetingRows(rows,'p1');
 assert.deepEqual(validated.map(r=>r.id),['early','late']);
 assert.notEqual(validated[0],early);
 assert.deepEqual(rows,snapshot);
 assert.deepEqual(validateVerifiedQaMeetingRows([],'p1'),[]);
});

test('A wrong tenant or unverified source fails closed in both Home and Agenda',async()=>{
 for(const rows of [
  [row('m1'),row('foreign','p2')],
  [{...row(),is_calendar_verified:false}],
  [{...row(),source_status:'Cancelada'}],
  [{...row(),title:''}],
  [row(),row()],
  [{...row(),id:''}],
  [null]
 ]) {
  assert.throws(()=>validateVerifiedQaMeetingRows(rows,'p1'));
  await assert.rejects(loadVerifiedAgenda({listVerifiedQaMeetings:async()=>rows},'p1'));
 }
 assert.throws(()=>validateVerifiedQaMeetingRows([row()],'p2'));
});

test('Invalid or ambiguous timestamps are rejected instead of producing an empty agenda',()=>{
 for(const value of ['2026-02-30T12:00:00Z','2026-11-15T11:00:00','2026-11-15T25:00:00Z','invalid',null]){
  assert.throws(()=>validateVerifiedQaMeetingRows([{...row(),start_at:value}],'p1'));
 }
 assert.throws(()=>validateVerifiedQaMeetingRows([{...row(),end_at:'2026-11-15T10:30:00-05:00'}],'p1'));
 assert.throws(()=>validateVerifiedQaMeetingRows([row()],''));
 assert.throws(()=>validateVerifiedQaMeetingRows(null,'p1'));
});

test('The 500th row is a guard, not silently truncated into a supposedly complete calendar',()=>{
 const nearLimit=Array.from({length:499},(_,i)=>row(String(i)));
 assert.equal(validateVerifiedQaMeetingRows(nearLimit,'p1').length,499);
 const atLimit=[...nearLimit,row('499')];
 assert.throws(()=>validateVerifiedQaMeetingRows(atLimit,'p1'),/incompleta/);
 const repo=readFileSync(new URL('../src/js/services/supabase.js',import.meta.url),'utf8');
 assert.match(repo,/\.eq\('source_status','Confirmada'\)\.order\('start_at',\{ascending:true\}\)\.limit\(501\)/);
});

test('Both Agenda and meeting calendar share validation and never show raw SQL/provider errors',()=>{
 const agenda=readFileSync(new URL('../src/js/ui-verified-agenda.js',import.meta.url),'utf8');
 const meeting=readFileSync(new URL('../src/js/ui-meeting-assessment.js',import.meta.url),'utf8');
 assert.match(agenda,/loadVerifiedAgenda\(repo,projectId\)/);
 assert.match(meeting,/loadVerifiedAgenda\(repo,projectId\)/);
 assert.match(meeting,/verifiedAgendaUiError\(error\)/);
 assert.doesNotMatch(meeting,/No se pudo consultar la agenda QA autorizada: '\+error\.message/);
 const secret='SQL JWT provider details for another tenant';
 assert.equal(verifiedAgendaUiError(new Error(secret)),AGENDA_GENERIC_LOAD_ERROR);
 assert.doesNotMatch(verifiedAgendaUiError(new Error(secret)),/SQL|JWT|provider/);
});
