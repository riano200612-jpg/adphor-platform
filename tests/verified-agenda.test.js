import test from 'node:test';
import assert from 'node:assert/strict';
import {loadVerifiedAgenda,filterVerifiedAgenda,bogotaAgendaDate,readVerifiedAgendaQuery,verifiedAgendaUiError,AGENDA_SOURCE_UNAVAILABLE,AGENDA_GENERIC_LOAD_ERROR} from '../src/js/services/verified-agenda.js';
import {answerMissAdphor} from '../src/js/ui-miss-adphor-chat.js';
const event={id:'m1',project_id:'p1',title:'Consejo',kind:'Consejo',source_status:'Confirmada',start_at:'2026-11-12T02:00:00Z',end_at:'2026-11-12T03:00:00Z',is_calendar_verified:true};
test('agenda reads only verified events of the requested property and preserves source identity',async()=>{
 let requested;
 const repo={listVerifiedQaMeetings:async project=>{requested=project;return [event,{...event,id:'other',project_id:'p2'},{...event,id:'unverified',is_calendar_verified:false}];}};
 const rows=await loadVerifiedAgenda(repo,'p1');assert.equal(requested,'p1');assert.deepEqual(rows,[event]);assert.notEqual(rows[0],event);
});
test('agenda distinguishes empty data from disabled, invalid and failed queries',async()=>{
 assert.deepEqual(await loadVerifiedAgenda({listVerifiedQaMeetings:async()=>[]},'p1'),[]);
 await assert.rejects(loadVerifiedAgenda({verifiedCalendarEnabled:false},'p1'),/no está habilitado/);
 await assert.rejects(loadVerifiedAgenda({},'p1'),/no está disponible/);
 await assert.rejects(loadVerifiedAgenda({listVerifiedQaMeetings:async()=>({})},'p1'),/no válida/);
 await assert.rejects(loadVerifiedAgenda({listVerifiedQaMeetings:async()=>{throw Error('failed');}},'p1'),/failed/);
 await assert.rejects(loadVerifiedAgenda({listVerifiedQaMeetings:async()=>[{...event,end_at:'invalid'}]},'p1'),/incompletos/);
});
test('missing verified meeting source is not presented as an empty agenda or as a raw provider error',()=>{
 assert.deepEqual(readVerifiedAgendaQuery({data:[],error:null}),[]);
 const missing={data:null,error:{code:'PGRST205',message:'Could not find the table public.qa_meeting_events in the schema cache'}};
 assert.throws(()=>readVerifiedAgendaQuery(missing),new RegExp(AGENDA_SOURCE_UNAVAILABLE.replace(/[.*+?^\u0024{}()|[\]\\]/g,'\\$&')));
 assert.equal(verifiedAgendaUiError(new Error(AGENDA_SOURCE_UNAVAILABLE)),AGENDA_SOURCE_UNAVAILABLE);
 assert.equal(verifiedAgendaUiError(new Error('raw technical SQL provider error')),AGENDA_GENERIC_LOAD_ERROR);
 assert.throws(()=>readVerifiedAgendaQuery({error:{code:'PGRST116',message:'technical failed'}}),/technical failed/);
});
test('agenda filters by Bogotá day, source status and normalized text without changing records',()=>{
 assert.equal(bogotaAgendaDate(event.start_at),'2026-11-11');
 assert.equal(filterVerifiedAgenda([event],{date:'2026-11-11',search:'consejo',status:'Confirmada'}).length,1);
 assert.equal(filterVerifiedAgenda([event],{date:'2026-11-12'}).length,0);
 assert.equal(filterVerifiedAgenda([event],{status:'Cancelada'}).length,0);
 assert.equal(filterVerifiedAgenda([event],{search:'otra'}).length,0);
 assert.equal(bogotaAgendaDate('invalid'),'');
});
test('Miss navigates to agenda only when available and retains the property guard',()=>{
 const ctx={project:{id:'p1'},projectId:'p1',page:'agenda',availablePages:['agenda']};
 assert.equal(answerMissAdphor('ver agenda',ctx).page,'agenda');
 assert.match(answerMissAdphor('¿Cómo uso este módulo?',ctx).text,/carga es puntual/);
 assert.equal(answerMissAdphor('ver agenda',{...ctx,projectId:'p2'}).page,null);
 assert.equal(answerMissAdphor('ver agenda',{...ctx,availablePages:[]}).page,null);
});

test('Miss does not imply that an administrative switch enables corporate Agenda writes',()=>{
 const result=answerMissAdphor('¿Cómo uso este módulo?',{project:{id:'p1'},projectId:'p1',page:'agenda',availablePages:['agenda'],mode:'cloud'});
 assert.match(result.text,/aún no están conectadas/);
 assert.doesNotMatch(result.text,/requieren habilitación administrativa/);
});
