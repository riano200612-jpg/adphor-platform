import test from 'node:test';
import assert from 'node:assert/strict';
import {
 isMissOperationalQuestion,summarizeMissOperations,describeMissOperations
} from '../src/js/services/miss-operations-summary.js';
import {mountMissAdphorChat} from '../src/js/ui-miss-adphor-chat.js';

const now=Date.parse('2026-11-14T17:00:00Z');
const payload={
 projectId:'p1',now,
 tickets:[{project_id:'p1',status:'Pendiente'},{project_id:'p1',status:'Cerrada'},
  {project_id:'p2',status:'Pendiente',title:'SECRETO OTRO PROYECTO'}],
 pqrs:[{project_id:'p1',id:'case-1',status:'open',due_at:'2026-11-13T00:00:00Z'}],
 visits:[{project_id:'p1',status:'programada'},{project_id:'p1',status:'completada'}],
 meetings:[{project_id:'p1',title:'Consejo',source_status:'Confirmada',is_calendar_verified:true,
  start_at:'2026-11-19T16:00:00Z'}]
};

test('Miss recognizes only deliberate cross-module reporting requests',()=>{
 assert.equal(isMissOperationalQuestion('¿Panorama operativo?'),true);
 assert.equal(isMissOperationalQuestion('¿Qué debo revisar hoy?'),true);
 assert.equal(isMissOperationalQuestion('¿Resumen de esta copropiedad?'),true);
 assert.equal(isMissOperationalQuestion('Muéstrame información privada del vecino'),false);
});
test('Three-stage rules use four sources while excluding unrelated local tickets',()=>{
 const r=summarizeMissOperations(payload);
 assert.deepEqual({
  tickets:r.ticketsOpen,pqrs:r.pqrsOpen,overdue:r.pqrsOverdue,
  visits:r.visitsTotal,active:r.visitsActive,verified:r.verifiedMeetings,next:r.meetingsNext
 },{tickets:1,pqrs:1,overdue:1,visits:2,active:1,verified:1,next:1});
 const text=describeMissOperations(r);
 assert.match(text,/Operaciones → Análisis → Informes/);
 assert.match(text,/mediante reglas de consulta/);
 assert.match(text,/Google Calendar/);
 assert.doesNotMatch(text,/SECRETO|Consejo|case-1/);
 assert.equal(r.readonly,true);
 assert.equal(r.engine,'rules');
});
test('An empty verified QA source set never claims there are live Google bookings',()=>{
 const r=summarizeMissOperations({...payload,pqrs:[],visits:[],meetings:[],tickets:[]});
 assert.equal(r.verifiedMeetings,0);
 assert.match(describeMissOperations(r),/no una sincronización en vivo/);
});
test('Fail closed if any server source returns another tenant, malformed values or incomplete pages',()=>{
 for(const key of ['pqrs','visits','meetings']){
  const row={...payload[key][0],project_id:'p2'};
  assert.throws(()=>summarizeMissOperations({...payload,[key]:[row]}),/fuera del alcance/);
 }
 assert.throws(()=>summarizeMissOperations({...payload,pqrs:[{project_id:'p1',id:'x',status:'closed'}]}),/PQRS no verificable/);
 assert.throws(()=>summarizeMissOperations({...payload,visits:[{project_id:'p1',status:'fake'}]}),/Visitas no verificables/);
 assert.throws(()=>summarizeMissOperations({...payload,meetings:[{...payload.meetings[0],is_calendar_verified:false}]}),/Reuniones no verificables/);
 assert.throws(()=>summarizeMissOperations({...payload,meetings:Array.from({length:501},()=>payload.meetings[0])}),/incompletos/);
 assert.throws(()=>summarizeMissOperations({...payload,visits:null}),/fuera del alcance/);
 assert.throws(()=>summarizeMissOperations({...payload,projectId:'p/evil'}),/Contexto/);
});
test('Miss only reads operational panorama for managers; errors and stale replies reveal nothing',async()=>{
 const oldDocument=globalThis.document;
 globalThis.document={createElement:()=>({})};
 const messages=[];
 let current={project:{id:'p1',name:'QA'},projectId:'p1',userId:'actor-a',
  role:'admin',mode:'cloud',tickets:payload.tickets,availablePages:['tickets','pqrs','visits','meetings']};
 let submit;
 let loads=0;
 const input={value:''};
 const nodes={
  '.miss-chat-toggle':{addEventListener(){}},
  '.miss-chat-panel':{},
  '.miss-chat-messages':{append(node){if(String(node.className||'').includes('miss-chat-msg'))messages.push(node.textContent||'');}},
  form:{querySelector:()=>input,addEventListener(_,fn){submit=fn;}}
 };
 const host={isConnected:true,querySelector:k=>nodes[k],querySelectorAll:()=>[]};
 let loadPqrs=async()=>{loads++;return payload.pqrs;};
 let loadVisits=async()=>{loads++;return payload.visits;};
 let loadMeetings=async()=>{loads++;return payload.meetings;};
 const ask=async q=>{input.value=q;submit({preventDefault(){}});await new Promise(r=>setImmediate(r));};
 try{
  mountMissAdphorChat(host,{context:()=>current,onNavigate(){},
   loadPqrs:id=>{assert.equal(id,'p1');return loadPqrs();},
   loadVisits:id=>{assert.equal(id,'p1');return loadVisits();},
   loadMeetings:id=>{assert.equal(id,'p1');return loadMeetings();}
  });
  await ask('Panorama operativo');
  assert.equal(loads,3);
  assert.match(messages.at(-1),/Bitácora 1 casos sin cerrar/);
  assert.match(messages.at(-1),/PQRS 1 en gestión/);
  assert.match(messages.at(-1),/Operaciones → Análisis → Informes/);
  assert.doesNotMatch(messages.at(-1),/SECRETO/);

  current={...current,role:'viewer'};
  await ask('Panorama operativo');
  assert.equal(loads,3);
  assert.match(messages.at(-1),/Administración o Coordinación/);

  current={...current,role:'admin'};
  loadVisits=async()=>{throw Error('Private SQL details');};
  await ask('Panorama operativo');
  assert.match(messages.at(-1),/No pude verificar todas las fuentes/);
  assert.doesNotMatch(messages.at(-1),/Private SQL/);

  let done;
  loadVisits=()=>new Promise(resolve=>{done=resolve;});
  input.value='Panorama operativo';submit({preventDefault(){}});
  const size=messages.length;
  current={...current,userId:'actor-b'};
  done(payload.visits);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(messages.length,size);
 }finally{globalThis.document=oldDocument;}
});
