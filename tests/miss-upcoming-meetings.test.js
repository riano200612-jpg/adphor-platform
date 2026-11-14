import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 answerMissAdphor,isMissUpcomingMeetingQuestion,upcomingMissMeetings,mountMissAdphorChat
} from '../src/js/ui-miss-adphor-chat.js';

const now=Date.parse('2026-11-14T17:00:00Z');
const meeting=(title,start_at,project_id='p1')=>({
 id:title,project_id,title,start_at,is_calendar_verified:true,source_status:'Confirmada'
});
const upcoming=[
 meeting('Fuera de calendario','2026-11-10T11:00:00-05:00'),
 meeting('Martes','2026-11-17T09:00:00-05:00'),
 meeting('Lunes','2026-11-16T10:00:00-05:00')
];

test('Intent for upcoming meetings is deliberate, never asks about unrelated personal calendars',()=>{
 for(const q of ['Próximas reuniones','¿Cuáles son mis próximas reuniones?',
  '¿Cuáles son las próximas reuniones de esta copropiedad?','Miss ADPHOR, ¿qué reuniones tengo próximamente?']){
  assert.equal(isMissUpcomingMeetingQuestion(q),true,q);
 }
 assert.equal(isMissUpcomingMeetingQuestion('Reuniones privadas de otros residentes'),false);
});

test('Upcoming meetings are scoped to the selected property, ordered and time-zone aware',()=>{
 const result=upcomingMissMeetings(upcoming,'p1',now);
 assert.equal(result.count,2);
 assert.deepEqual(result.items.map(x=>x.title),['Lunes','Martes']);
 assert.equal(result.items[0].title,'Lunes');
 assert.equal(upcoming[1].title,'Martes','original order is preserved');
 const none=upcomingMissMeetings([upcoming[0]],'p1',now);
 assert.deepEqual(none,{count:0,items:[]});
});

test('Never call another tenant meeting or a truncated, unverified or invalid import authoritative',()=>{
 for(const bad of [
  [...upcoming,meeting('Privada','2026-11-18T09:00:00-05:00','p2')],
  [{...upcoming[0],is_calendar_verified:false}],
  [{...upcoming[0],source_status:'Cancelada'}],
  [{...upcoming[0],start_at:'2026-02-30T09:00:00-05:00'}],
  [{...upcoming[0],start_at:'2026-11-17T14:00:00'}],
  [{...upcoming[0],title:''}],
  null,
  Array.from({length:500},(_,i)=>meeting('Meeting '+i,'2026-11-17T09:00:00-05:00'))
 ])assert.throws(()=>upcomingMissMeetings(bad,'p1',now));
 assert.throws(()=>upcomingMissMeetings(upcoming,'',now));
 assert.throws(()=>upcomingMissMeetings(upcoming,'p1',Number.NaN));
});

test('Specialized PQRS and Visitas questions are routed before generic Bitácora status',()=>{
 const context={project:{id:'p1',name:'QA'},projectId:'p1',mode:'cloud',
  tickets:[{project_id:'p1',status:'Pendiente'}],availablePages:['pqrs','visits','tickets','meetings'],role:'admin'};
 const pqrs=answerMissAdphor('Casos PQRS pendientes',context);
 assert.equal(pqrs.page,'pqrs');
 assert.doesNotMatch(pqrs.text,/casos visibles/);
 const visits=answerMissAdphor('Estado de las visitas',context);
 assert.equal(visits.page,'visits');
 assert.doesNotMatch(visits.text,/Bitácora/);
 const general=answerMissAdphor('Casos pendientes',context);
 assert.equal(general.page,'tickets');
 const help=answerMissAdphor('¿Cómo agendar una reunión?',context);
 assert.match(help.text,/no crea ni confirma reservas/);
});

test('Upcoming list only renders imported tenant meetings, handles empty responses/errors, and cancels stale user answers',async()=>{
 const previousDocument=globalThis.document;
 globalThis.document={createElement:()=>({})};
 let current={project:{id:'p1',name:'QA'},projectId:'p1',userId:'u1',
  tickets:[],role:'admin',mode:'cloud',now,availablePages:['agenda','meetings','tickets']};
 const messages=[];
 let submit,loader;
 const input={value:''};
 const nodes={
  '.miss-chat-toggle':{addEventListener(){}},
  '.miss-chat-panel':{},
  '.miss-chat-messages':{append(node){if(String(node.className||'').includes('miss-chat-msg'))messages.push(node.textContent);}},
  form:{querySelector:()=>input,addEventListener(_,callback){submit=callback;}}
 };
 const host={isConnected:true,querySelector:key=>nodes[key],querySelectorAll:()=>[]};
 try {
  mountMissAdphorChat(host,{context:()=>current,onNavigate(){},
   loadMeetings:project=>{assert.equal(project,'p1');return loader(project);}
  });
  const ask=async(q='Próximas reuniones')=>{
   input.value=q;submit({preventDefault(){}});await new Promise(resolve=>setImmediate(resolve));
  };
  loader=async()=>upcoming;
  await ask();
  assert.match(messages.at(-1),/2 próximas reuniones/);
  assert.match(messages.at(-1),/Lunes.*Martes/);
  assert.match(messages.at(-1),/no agenda en vivo ni reserva/);
  assert.doesNotMatch(messages.at(-1),/Fuera de calendario/);

  loader=async()=>[upcoming[0]];
  await ask();
  assert.match(messages.at(-1),/No hay reuniones futuras verificadas/);
  assert.match(messages.at(-1),/no demuestra que el calendario corporativo esté libre/);

  loader=async()=>{throw Error('secret internal provider');};
  await ask();
  assert.match(messages.at(-1),/No pude verificar las próximas reuniones/);
  assert.doesNotMatch(messages.at(-1),/secret internal/);

  let finish;
  loader=()=>new Promise(resolve=>{finish=resolve;});
  input.value='Próximas reuniones';
  submit({preventDefault(){}});
  const before=messages.length;
  current={...current,userId:'u2'};
  finish(upcoming);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(messages.length,before);

  current={...current,userId:'u1'};
  loader=()=>new Promise(resolve=>{finish=resolve;});
  input.value='Próximas reuniones';
  submit({preventDefault(){}});
  const beforeSwitch=messages.length;
  current={...current,projectId:'p2',project:{id:'p2',name:'Otra'}};
  finish(upcoming);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(messages.length,beforeSwitch);
 }finally {globalThis.document=previousDocument;}
});

test('Miss shows upcoming meetings control without exposing any private Calendar credentials',()=>{
 const ui=readFileSync(new URL('../src/js/ui-miss-adphor-chat.js',import.meta.url),'utf8');
 assert.match(ui,/data-miss-question="Próximas reuniones"/);
 assert.match(ui,/upcomingMissMeetings\(await loadMeetings\(current.projectId\)/);
 assert.doesNotMatch(ui,/service_role|refresh_token/);
});
