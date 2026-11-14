import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 isMissVisitQuestion,isMissCorporateAvailabilityQuestion,summarizeMissVisits,
 mountMissAdphorChat
} from '../src/js/ui-miss-adphor-chat.js';

const ctx={
 project:{id:'p1',name:'Copropiedad autorizada'},projectId:'p1',userId:'user-a',
 role:'admin',mode:'cloud',page:'dashboard',tickets:[],availablePages:['visits','meetings','tickets']
};
const visit=(status,project_id='p1')=>({status,project_id});

test('Miss recognizes explicit real-data requests without interpreting another tenant',()=>{
 assert.equal(isMissVisitQuestion('¿Cuántas visitas tiene esta copropiedad?'),true);
 assert.equal(isMissVisitQuestion('Visitas pendientes'),true);
 assert.equal(isMissVisitQuestion('visitas de otra copropiedad'),false);
 assert.equal(isMissCorporateAvailabilityQuestion('Disponibilidad corporativa'),true);
 assert.equal(isMissCorporateAvailabilityQuestion('Muéstrame los eventos privados de otra persona'),false);
});

test('Miss validates every visit row and status before disclosing aggregated QA counts',()=>{
 const rows=[visit('programada'),visit('en_ejecucion'),visit('completada'),visit('cancelada')];
 assert.deepEqual(summarizeMissVisits(rows,'p1'),{
  total:4,scheduled:1,active:1,completed:1,cancelled:1
 });
 assert.deepEqual(summarizeMissVisits([],'p1'),{
  total:0,scheduled:0,active:0,completed:0,cancelled:0
 });
 for(const invalid of [[...rows,visit('programada','p2')],[visit('invalid')],[{}],null]){
  assert.throws(()=>summarizeMissVisits(invalid,'p1'));
 }
 assert.throws(()=>summarizeMissVisits(rows,''));
});

test('Miss reads existing project-scoped Visits and the authorized freeBusy adapter, never event details',async()=>{
 const old=globalThis.document;
 globalThis.document={createElement:()=>({})};
 let current={...ctx};
 const messages=[],jumps=[];
 let submit;
 const input={value:''};
 const nodes={
  '.miss-chat-toggle':{addEventListener(){}},
  '.miss-chat-panel':{},
  '.miss-chat-messages':{append(node){messages.push(node.textContent||'');}},
  form:{querySelector:()=>input,addEventListener(_,handler){submit=handler;}}
 };
 const host={isConnected:true,querySelector:key=>nodes[key],querySelectorAll:()=>[]};
 let visitCalls=0,calendarCalls=0;
 let loadVisits=async projectId=>{
  visitCalls++;
  assert.equal(projectId,'p1');
  return [visit('programada'),visit('en_ejecucion')];
 };
 let loadCalendarBusy=async(projectId,start,end)=>{
  calendarCalls++;
  assert.equal(projectId,'p1');
  assert.equal(Date.parse(end)-Date.parse(start),7*86400000);
  return [{start:'2026-11-17T14:00:00Z',end:'2026-11-17T15:00:00Z'}];
 };
 try{
  mountMissAdphorChat(host,{context:()=>current,onNavigate:page=>jumps.push(page),
   loadVisits:id=>loadVisits(id),loadCalendarBusy:(id,start,end)=>loadCalendarBusy(id,start,end)});
  const ask=async(question)=>{
   input.value=question;
   submit({preventDefault(){}});
   await new Promise(resolve=>setImmediate(resolve));
  };
  await ask('¿Cuántas visitas tiene esta copropiedad?');
  assert.equal(visitCalls,1);
  assert.match(messages.at(-1),/Programadas: 1 · En ejecución: 1/);
  assert.match(messages.at(-1),/Supabase QA/);
  assert.doesNotMatch(messages.join(' '),/p2/);

  await ask('Disponibilidad corporativa');
  assert.equal(calendarCalls,1);
  assert.match(messages.join(' '),/1 intervalos ocupados/);
  assert.doesNotMatch(messages.join(' '),/asuntos ni participantes[^.]*\w+@/);
  assert.deepEqual(jumps,[]);

  current={...ctx,role:'viewer'};
  await ask('Disponibilidad corporativa');
  assert.equal(calendarCalls,1);
  assert.match(messages.at(-1),/sesión administrativa autorizada/);

  current={...ctx};
  loadCalendarBusy=async()=>{throw Error('secret provider token or personal event');};
  await ask('Disponibilidad corporativa');
  assert.match(messages.at(-1),/No pude comprobar/);
  assert.doesNotMatch(messages.at(-1),/secret provider token/);

  loadVisits=async()=>{throw Error('SQL contents');};
  await ask('¿Cuántas visitas tiene esta copropiedad?');
  assert.match(messages.at(-1),/No pude verificar las Visitas/);
  assert.doesNotMatch(messages.at(-1),/SQL contents/);

  let finish;
  loadVisits=()=>new Promise(resolve=>{finish=resolve;});
  input.value='¿Cuántas visitas tiene esta copropiedad?';
  submit({preventDefault(){}});
  const baseline=messages.length;
  current={...ctx,userId:'user-b'};
  finish([visit('programada')]);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(messages.length,baseline,'must not report after user identity changes');

  current={...ctx};
  loadVisits=()=>new Promise(resolve=>{finish=resolve;});
  input.value='¿Cuántas visitas tiene esta copropiedad?';
  submit({preventDefault(){}});
  const baseline2=messages.length;
  current={...ctx,projectId:'p2',project:{id:'p2',name:'Otra copropiedad'}};
  finish([visit('programada')]);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(messages.length,baseline2,'must not report after project changes');
 }finally{
  globalThis.document=old;
 }
});

test('Miss relies on authenticated QA repositories, never the ChatGPT connector or direct calendar credentials',()=>{
 const app=readFileSync(new URL('../src/js/app.js',import.meta.url),'utf8');
 assert.match(app,/loadVisits:repo.mode==='cloud'/);
 assert.match(app,/repo.visits.list\(id\)/);
 assert.match(app,/loadCalendarBusy:repo.mode==='cloud'/);
 assert.match(app,/repo.meetingAvailability\(id,start,end\)/);
 assert.match(app,/userId:state.user\?\.id/);
});
