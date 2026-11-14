import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {isMissOperationalDayQuestion,summarizeMissOperationalDay,describeMissOperationalDay}
 from '../src/js/services/miss-operational-day.js';
import {mountMissAdphorChat} from '../src/js/ui-miss-adphor-chat.js';

const now=Date.parse('2026-11-14T18:00:00Z'); // 13:00 America/Bogota
const item={projectId:'p1',now,
 pqrs:[
  {id:'q1',project_id:'p1',status:'open',due_at:'2026-11-13T23:00:00-05:00'},
  {id:'q2',project_id:'p1',status:'assigned',due_at:'2026-11-14T23:00:00-05:00'},
  {id:'q3',project_id:'p1',status:'in_progress',due_at:null}
 ],
 visits:[
  {request_id:'v1',project_id:'p1',status:'programada',scheduled_at:'2026-11-14T09:00:00-05:00'},
  {request_id:'v2',project_id:'p1',status:'en_ejecucion',scheduled_at:'2026-11-13T10:00:00-05:00'},
  {request_id:'v3',project_id:'p1',status:'completada',scheduled_at:'2026-11-14T08:00:00-05:00'},
  {request_id:'v4',project_id:'p1',status:'programada',scheduled_at:'2026-11-15T09:00:00-05:00'}
 ],
 meetings:[
  {id:'m1',project_id:'p1',title:'Confidencial, no exponer',source_status:'Confirmada',
   is_calendar_verified:true,start_at:'2026-11-14T15:00:00Z'},
  {id:'m2',project_id:'p1',title:'Mañana',source_status:'Confirmada',
   is_calendar_verified:true,start_at:'2026-11-15T15:00:00Z'}
 ]
};

test('Exact intentional prompts for one tenant daily brief',()=>{
 for(const q of ['Agenda operativa hoy','¿Agenda operativa de hoy?',
  'Miss ADPHOR, ¿qué tengo hoy en ADPHOR?','Resumen de actividades de hoy',
  'Actividades de hoy en esta copropiedad']){
  assert.equal(isMissOperationalDayQuestion(q),true,q);
 }
 for(const q of ['Datos de otra copropiedad','Envía agenda al vecino',
  'Confirma reserva hoy','Agenda corporativa de otra persona'])assert.equal(isMissOperationalDayQuestion(q),false,q);
});

test('Daily brief combines three verified sources, calendar day in Bogota, no secrets or customer details',()=>{
 const result=summarizeMissOperationalDay(item);
 assert.deepEqual(result,{
  projectId:'p1',day:'2026-11-14',pqrsOpen:3,pqrsOverdue:1,pqrsDueToday:1,
  visitsToday:1,visitsRunning:1,meetingsToday:1,
  source:'supabase_qa_scoped',engine:'rules',readonly:true
 });
 const message=describeMissOperationalDay(result);
 assert.match(message,/Agenda operativa de 2026-11-14 \(Colombia\)/);
 assert.match(message,/PQRS 3 en gestión, 1 vencidas y 1 con vencimiento hoy/);
 assert.match(message,/Visitas 1 registradas hoy, 1 en ejecución/);
 assert.match(message,/Reuniones 1 confirmadas en la importación QA para hoy/);
 assert.match(message,/Operaciones → Análisis → Informes por reglas/);
 assert.match(message,/no confirma eventos actuales de Google Calendar/);
 assert.doesNotMatch(message,/Confidencial|q1|m1|v1|token|responsable/);
});

test('Colombia day is respected near UTC midnight, and deadlines today may already be overdue',()=>{
 const time=Date.parse('2026-11-15T02:00:00Z'); // Saturday 21:00 Colombia
 const result=summarizeMissOperationalDay({
  projectId:'p1',now:time,
  pqrs:[{id:'q1',project_id:'p1',status:'open',due_at:'2026-11-14T18:00:00-05:00'}],
  visits:[{request_id:'v1',project_id:'p1',status:'programada',scheduled_at:'2026-11-14T23:00:00-05:00'}],
  meetings:[{id:'m1',project_id:'p1',source_status:'Confirmada',is_calendar_verified:true,
   start_at:'2026-11-15T00:00:00Z'}]
 });
 assert.equal(result.day,'2026-11-14');
 assert.equal(result.pqrsOverdue,1);
 assert.equal(result.pqrsDueToday,1);
 assert.equal(result.visitsToday,1);
 assert.equal(result.meetingsToday,1);
});

test('Empty authorized source sets must never assert Google Calendar is free',()=>{
 const result=summarizeMissOperationalDay({projectId:'p1',pqrs:[],visits:[],meetings:[],now});
 assert.equal(result.visitsToday,0);
 const desc=describeMissOperationalDay(result);
 assert.match(desc,/La Agenda es una importación puntual/);
 assert.doesNotMatch(desc,/calendario libre|no hay reservas/);
});

test('Fail closed: wrong tenant, duplicate IDs, statuses, unverified dates, truncation and missing source',()=>{
 for(const key of ['pqrs','visits','meetings']){
  const copy={...item,[key]:[{...item[key][0],project_id:'p2'}]};
  assert.throws(()=>summarizeMissOperationalDay(copy),/fuera del alcance/);
  assert.throws(()=>summarizeMissOperationalDay({...item,[key]:[item[key][0],item[key][0]]}),/duplicado/);
 }
 for(const [key,patch] of [
  ['pqrs',{status:'closed'}],
  ['pqrs',{due_at:'2026-02-30T12:00:00-05:00'}],
  ['visits',{status:'fake'}],
  ['visits',{scheduled_at:'2026-11-14T09:00:00'}],
  ['meetings',{is_calendar_verified:false}],
  ['meetings',{source_status:'Cancelada'}],
  ['meetings',{start_at:'2026-11-14T10:00:00'}]
 ]){
  assert.throws(()=>summarizeMissOperationalDay({...item,[key]:[{...item[key][0],...patch}]}));
 }
 for(const key of ['pqrs','visits','meetings']){
  assert.throws(()=>summarizeMissOperationalDay({...item,[key]:null}),/Lectura incompleta/);
 }
 assert.throws(()=>summarizeMissOperationalDay({...item,projectId:'not/an/id'}));
 assert.throws(()=>summarizeMissOperationalDay({...item,now:NaN}));
 assert.throws(()=>summarizeMissOperationalDay({...item,meetings:Array.from({length:500},(_,i)=>({...item.meetings[0],id:String(i)}))}),/Lectura incompleta/);
});

test('Assistant reads no sources for viewer or demo; authorized admin sees aggregate; errors fail closed',async()=>{
 const oldDocument=globalThis.document;
 globalThis.document={createElement:()=>({})};
 const input={value:''},messages=[];
 let current={project:{id:'p1'},projectId:'p1',userId:'u1',
  role:'admin',mode:'cloud',now,tickets:[],availablePages:['unified','visits']};
 let submit,read=async()=>item,calls=0;
 const nodes={
  '.miss-chat-toggle':{addEventListener(){}},'.miss-chat-panel':{},
  '.miss-chat-messages':{append(node){if(String(node.className||'').includes('miss-chat-msg'))messages.push(node.textContent||'');}},
  form:{querySelector:()=>input,addEventListener(_,fn){submit=fn;}}
 };
 const host={isConnected:true,querySelector:key=>nodes[key],querySelectorAll:()=>[]};
 const ask=async q=>{input.value=q;submit({preventDefault(){}});await new Promise(r=>setImmediate(r));};
 try{
  mountMissAdphorChat(host,{context:()=>current,onNavigate(){},
   loadPqrs:async id=>{assert.equal(id,'p1');calls++;return (await read()).pqrs;},
   loadVisits:async id=>{assert.equal(id,'p1');calls++;return (await read()).visits;},
   loadMeetings:async id=>{assert.equal(id,'p1');calls++;return (await read()).meetings;}
  });
  await ask('Agenda operativa de hoy');
  assert.equal(calls,3);
  assert.match(messages.at(-1),/Agenda operativa de 2026-11-14/);
  assert.doesNotMatch(messages.at(-1),/Confidencial/);
  current={...current,role:'viewer'};
  await ask('Agenda operativa de hoy');
  assert.equal(calls,3);
  assert.match(messages.at(-1),/Administración o Coordinación/);
  current={...current,role:'coordinator',mode:'demo'};
  await ask('Agenda operativa hoy');
  assert.equal(calls,3);
  current={...current,mode:'cloud'};
  read=async()=>{throw Error('private SQL response and JWT');};
  await ask('Agenda operativa hoy');
  assert.match(messages.at(-1),/No pude verificar la agenda operativa completa/);
  assert.doesNotMatch(messages.at(-1),/private SQL|JWT/);
 }finally{globalThis.document=oldDocument;}
});

test('Outdated daily report is never shown after user, project, role or another question changes',async()=>{
 const oldDocument=globalThis.document;
 globalThis.document={createElement:()=>({})};
 const input={value:''},messages=[];
 let current={project:{id:'p1'},projectId:'p1',userId:'u1',role:'admin',mode:'cloud',
  now,tickets:[],availablePages:['unified']};
 let submit,resolvers=[];
 const nodes={'.miss-chat-toggle':{addEventListener(){}},'.miss-chat-panel':{},
  '.miss-chat-messages':{append(node){if(String(node.className||'').includes('miss-chat-msg'))messages.push(node.textContent||'');}},
  form:{querySelector:()=>input,addEventListener(_,fn){submit=fn;}}};
 const host={isConnected:true,querySelector:key=>nodes[key],querySelectorAll:()=>[]};
 const ask=q=>{input.value=q;submit({preventDefault(){}});};
 try{
  mountMissAdphorChat(host,{context:()=>current,onNavigate(){},
   loadPqrs:()=>new Promise(resolve=>resolvers.push(resolve)),
   loadVisits:()=>Promise.resolve(item.visits),loadMeetings:()=>Promise.resolve(item.meetings)});
  for(const change of [
   c=>({...c,userId:'u2'}),
   c=>({...c,projectId:'p2',project:{id:'p2'}}),
   c=>({...c,role:'viewer'})
  ]){
   current={...current,userId:'u1',projectId:'p1',project:{id:'p1'},role:'admin'};
   ask('Agenda operativa hoy');const index=messages.length;
   current=change(current);resolvers.pop()(item.pqrs);
   await new Promise(resolve=>setImmediate(resolve));
   assert.equal(messages.length,index);
  }
  current={...current,role:'admin',userId:'u1',projectId:'p1',project:{id:'p1'}};
  ask('Agenda operativa hoy');ask('¿Cómo consulto PQRS?');
  const index=messages.length;
  resolvers.pop()(item.pqrs);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(messages.length,index);
 }finally{globalThis.document=oldDocument;}
});

test('No direct provider access, writes, or secret credentials are introduced',()=>{
 const app=readFileSync(new URL('../src/js/app.js',import.meta.url),'utf8');
 const ui=readFileSync(new URL('../src/js/ui-miss-adphor-chat.js',import.meta.url),'utf8');
 const service=readFileSync(new URL('../src/js/services/miss-operational-day.js',import.meta.url),'utf8');
 assert.match(app,/repo\.porto\.listAttention\(id\)/);
 assert.match(app,/repo\.visits\.list\(id\)/);
 assert.match(app,/repo\.listVerifiedQaMeetings\(id\)/);
 assert.match(ui,/data-miss-question="Agenda operativa de hoy"/);
 assert.match(ui,/summarizeMissOperationalDay\(/);
 assert.doesNotMatch(service,/fetch\(|service_role|refresh_token|localStorage|\.insert\(|\.update\(|\.delete\(/);
});
