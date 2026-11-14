import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 missVisitsScheduleIntent,summarizeMissVisitsSchedule,describeMissVisitsSchedule
} from '../src/js/services/miss-visits-schedule.js';
import {mountMissAdphorChat} from '../src/js/ui-miss-adphor-chat.js';

const now=Date.parse('2026-11-14T18:00:00Z'); // 13:00 Colombia
const visit=(id,status,scheduled_at,project_id='p1')=>({request_id:id,project_id,status,scheduled_at});
const rows=[
 visit('today-am','programada','2026-11-14T12:00:00-05:00'),
 visit('today-pm','programada','2026-11-14T16:00:00-05:00'),
 visit('tomorrow','programada','2026-11-15T09:00:00-05:00'),
 visit('running','en_ejecucion','2026-11-12T11:00:00-05:00'),
 visit('later','programada','2026-11-26T09:00:00-05:00'),
 visit('cancelled','cancelada','2026-11-14T16:00:00-05:00'),
 visit('complete','completada','2026-11-14T09:00:00-05:00')
];

test('Miss recognizes exact today/next Visits requests, but never another resident’s',()=>{
 for(const q of ['Visitas de hoy','¿Cuáles son las visitas de hoy?',
  'Miss ADPHOR, ¿qué visitas tenemos hoy?','Visitas para hoy']){
  assert.equal(missVisitsScheduleIntent(q),'today',q);
 }
 for(const q of ['Próximas visitas','Mis próximas visitas',
  '¿Cuáles son las próximas visitas de esta copropiedad?','Visitas de los próximos 7 días']){
  assert.equal(missVisitsScheduleIntent(q),'next',q);
 }
 for(const q of ['visitas ajenas','borra visitas','visitas pendientes','mira visitas de otro residente'])
  assert.equal(missVisitsScheduleIntent(q),null,q);
});

test('Today is Colombian calendar day; next seven days excludes past and canceled visits',()=>{
 const today=summarizeMissVisitsSchedule(rows,'p1','today',now);
 assert.equal(today.count,2);
 assert.equal(today.running,1);
 assert.deepEqual(today.items.map(item=>item.scheduledAt),[
  '2026-11-14T12:00:00-05:00','2026-11-14T16:00:00-05:00'
 ]);
 assert.deepEqual(rows.map(item=>item.request_id),[
  'today-am','today-pm','tomorrow','running','later','cancelled','complete'
 ],'input order unchanged');
 const next=summarizeMissVisitsSchedule(rows,'p1','next',now);
 assert.equal(next.count,2);
 assert.deepEqual(next.items.map(item=>item.scheduledAt),[
  '2026-11-14T16:00:00-05:00','2026-11-15T09:00:00-05:00'
 ]);
 const description=describeMissVisitsSchedule(next);
 assert.match(description,/próximos 7 días: 2/);
 assert.match(description,/Visitas actualmente en ejecución en el registro: 1/);
 assert.match(description,/Supabase QA bajo tu sesión y MFA AAL2/);
 assert.doesNotMatch(description,/today-pm|tomorrow|request_id|motive/);
 assert.match(description,/no reservas ni disponibilidad de Google Calendar/);
 assert.equal(next.readonly,true);
});

test('Today uses Bogota timezone across UTC midnight, not UTC calendar date',()=>{
 const midnight=Date.parse('2026-11-15T02:00:00Z'); // Sat 21:00 Colombia
 const result=summarizeMissVisitsSchedule([
  visit('saturday','programada','2026-11-14T23:30:00-05:00'),
  visit('sunday','programada','2026-11-15T00:30:00-05:00')
 ],'p1','today',midnight);
 assert.equal(result.count,1);
 assert.equal(result.items[0].scheduledAt,'2026-11-14T23:30:00-05:00');
});

test('Miss fails closed for cross-tenant rows, invalid dates/statuses, duplicates and truncation',()=>{
 for(const invalid of [
  [...rows,visit('outside','programada','2026-11-16T09:00:00-05:00','p2')],
  [rows[0],rows[0]],
  [visit('x','incorrecto','2026-11-14T15:00:00-05:00')],
  [visit('x','programada','2026-02-30T15:00:00-05:00')],
  [visit('x','programada','2026-11-14T15:00:00')],
  [visit('','programada','2026-11-14T15:00:00-05:00')],
  [null],null,
  Array.from({length:5000},(_,i)=>visit(String(i),'programada','2026-11-14T15:00:00-05:00'))
 ])assert.throws(()=>summarizeMissVisitsSchedule(invalid,'p1','next',now));
 for(const [project,mode,time] of [['p/evil','next',now],['p1','bad',now],['p1','next',NaN]])
  assert.throws(()=>summarizeMissVisitsSchedule(rows,project,mode,time));
});

test('No scheduled visits means no confirmed records, not free calendar availability',()=>{
 const result=summarizeMissVisitsSchedule([],'p1','next',now);
 assert.equal(result.count,0);
 const message=describeMissVisitsSchedule(result);
 assert.match(message,/No hay visitas activas registradas para el período/);
 assert.match(message,/no reservas ni disponibilidad de Google Calendar/);
});

test('Miss reads existing SQL Visits and never spills internal errors or a stale role/tenant response',async()=>{
 const originalDocument=globalThis.document;
 globalThis.document={createElement:()=>({})};
 const messages=[],input={value:''};
 let current={project:{id:'p1',name:'Autorizada'},projectId:'p1',userId:'u1',
  role:'admin',mode:'cloud',now,tickets:[],availablePages:['visits','meetings']};
 let submit,load=async()=>rows,calls=0;
 const nodes={
  '.miss-chat-toggle':{addEventListener(){}},
  '.miss-chat-panel':{},
  '.miss-chat-messages':{append(node){if(String(node.className||'').includes('miss-chat-msg'))messages.push(node.textContent||'');}},
  form:{querySelector:()=>input,addEventListener(_,cb){submit=cb;}}
 };
 const host={isConnected:true,querySelector:key=>nodes[key],querySelectorAll:()=>[]};
 const ask=async(q)=>{
  input.value=q;submit({preventDefault(){}});await new Promise(resolve=>setImmediate(resolve));
 };
 try{
  mountMissAdphorChat(host,{context:()=>current,onNavigate(){},
   loadVisits:id=>{assert.equal(id,'p1');calls++;return load();}
  });
  await ask('Visitas de hoy');
  assert.equal(calls,1);
  assert.match(messages.at(-1),/hoy \(horario de Colombia\): 2/);
  await ask('Próximas visitas');
  assert.equal(calls,2);
  assert.match(messages.at(-1),/próximos 7 días: 2/);

  load=async()=>{throw Error('TOKEN PRIVATE SQL');};
  await ask('Próximas visitas');
  assert.match(messages.at(-1),/No pude verificar el calendario de Visitas/);
  assert.doesNotMatch(messages.at(-1),/TOKEN PRIVATE/);

  current={...current,mode:'demo'};
  const oldCalls=calls;
  await ask('Visitas de hoy');
  assert.equal(calls,oldCalls);
  assert.match(messages.at(-1),/necesita una sesión autorizada/);

  current={...current,mode:'cloud'};
  let finish;
  load=()=>new Promise(resolve=>{finish=resolve;});
  input.value='Próximas visitas';submit({preventDefault(){}});
  const before=messages.length;
  current={...current,role:'viewer'};
  finish(rows);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(messages.length,before,'role downgrade must suppress response');

  current={...current,role:'admin'};
  input.value='Próximas visitas';submit({preventDefault(){}});
  const before2=messages.length;
  current={...current,userId:'u2'};
  finish(rows);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(messages.length,before2,'user change must suppress response');
 }finally{globalThis.document=originalDocument;}
});

test('The chat uses existing repo.visits.list with AAL2, no direct provider tokens',()=>{
 const app=readFileSync(new URL('../src/js/app.js',import.meta.url),'utf8');
 const js=readFileSync(new URL('../src/js/ui-miss-adphor-chat.js',import.meta.url),'utf8');
 const service=readFileSync(new URL('../src/js/services/miss-visits-schedule.js',import.meta.url),'utf8');
 assert.match(app,/repo\.visits\.list\(id\)/);
 assert.match(js,/data-miss-question="Visitas de hoy"/);
 assert.match(js,/data-miss-question="Próximas visitas"/);
 assert.match(js,/summarizeMissVisitsSchedule\(/);
 assert.doesNotMatch(service,/fetch\(|localStorage|service_role|refresh_token/);
});
