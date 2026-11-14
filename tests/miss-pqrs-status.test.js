import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mountMissAdphorChat} from '../src/js/ui-miss-adphor-chat.js';
import {
 isMissPqrsStatusQuestion,summarizeMissPqrsStatus,describeMissPqrsStatus
} from '../src/js/services/miss-pqrs-status.js';

const time=Date.parse('2026-11-14T17:00:00Z');
const row=(id,status,due_at=null,project_id='p1')=>({id,status,due_at,project_id});
const rows=[
 row('pqr-01','open','2026-11-13T18:00:00-05:00'),
 row('pqr-02','assigned','2026-11-17T18:00:00-05:00'),
 row('pqr-03','in_progress',null)
];

test('PQRS exact intent includes user phrasing but not foreign tenant or destructive questions',()=>{
 for(const q of ['PQRS pendientes','Mis PQRS pendientes','¿Qué PQRS hay pendientes?',
  '¿Estado de las PQRS?','¿Cuántas PQRS pendientes tiene esta copropiedad?',
  '¿Cuántas solicitudes PQRS están abiertas?','Casos PQRS pendientes']){
  assert.equal(isMissPqrsStatusQuestion(q),true,q);
 }
 for(const q of ['Borra PQRS vencidas','Revisa otros residentes','¿Qué puedo cambiar en PQRS?'])
  assert.equal(isMissPqrsStatusQuestion(q),false,q);
});

test('Miss reports real count per status, due dates, and missing deadlines with source label',()=>{
 const s=summarizeMissPqrsStatus(rows,'p1',time);
 assert.deepEqual(s,{total:3,open:1,assigned:1,inProgress:1,overdue:1,withoutDate:1,source:'supabase_qa_scoped'});
 assert.equal(summarizeMissPqrsStatus([],'p1',time).total,0);
 const message=describeMissPqrsStatus(s);
 assert.match(message,/Supabase QA: 3 en gestión/);
 assert.match(message,/1 abiertas · 1 asignadas · 1 en progreso · 1 vencidas/);
 assert.match(message,/1 sin fecha límite/);
 assert.match(message,/solo lectura/);
 assert.doesNotMatch(message,/pqr-01|pqr-02|pqr-03/);
});

test('Miss refuses cross-tenant, duplicated, missing or malformed PQRS records and page truncation',()=>{
 for(const bad of [
  [...rows,row('private','open',null,'p2')],
  [rows[0],rows[0]], [row('', 'open')], [row('x','closed')],
  [row('x','open','2026-02-30T18:00:00-05:00')],
  [row('x','open','2026-11-14T18:00:00')],
  [null], null, Array.from({length:5000},(_,i)=>row('x'+i,'open'))
 ])assert.throws(()=>summarizeMissPqrsStatus(bad,'p1',time));
 assert.throws(()=>summarizeMissPqrsStatus(rows,'',time));
 assert.throws(()=>summarizeMissPqrsStatus(rows,'p1',NaN));
 assert.throws(()=>describeMissPqrsStatus({total:4,open:1,assigned:1,inProgress:1,overdue:1,withoutDate:1,source:'supabase_qa_scoped'}));
});

test('PQRS live query uses authorized loader, suppresses SQL errors, and preserves project scope',async()=>{
 const prev=globalThis.document;
 globalThis.document={createElement:()=>({})};
 let context={project:{id:'p1',name:'Autorizada'},projectId:'p1',userId:'u1',
  role:'admin',mode:'cloud',now:time,availablePages:['pqrs','tickets'],tickets:[]};
 const messages=[],input={value:''};
 let submit,load=async()=>rows,callCount=0;
 const nodes={
  '.miss-chat-toggle':{addEventListener(){}},
  '.miss-chat-panel':{},
  '.miss-chat-messages':{append(node){if(String(node.className||'').includes('miss-chat-msg'))messages.push(node.textContent||'');}},
  form:{querySelector:()=>input,addEventListener(_,fn){submit=fn;}}
 };
 const host={isConnected:true,querySelector:k=>nodes[k],querySelectorAll:()=>[]};
 try {
  mountMissAdphorChat(host,{context:()=>context,onNavigate(){},loadPqrs:async id=>{
   assert.equal(id,'p1');callCount++;return load();
  }});
  async function ask(q='PQRS pendientes'){
   input.value=q;submit({preventDefault(){}});
   await new Promise(resolve=>setImmediate(resolve));
  }
  await ask();
  assert.equal(callCount,1);
  assert.match(messages.at(-1),/3 en gestión/);
  assert.doesNotMatch(messages.at(-1),/pqr-01/);
  await ask('Casos PQRS pendientes');
  assert.equal(callCount,2);

  load=async()=>{throw Error('SQL secret: another tenant case');};
  await ask();
  assert.match(messages.at(-1),/No pude verificar las PQRS pendientes/);
  assert.doesNotMatch(messages.at(-1),/SQL secret/);

  context={...context,mode:'demo'};
  const before=callCount;
  await ask();
  assert.equal(callCount,before);
  assert.match(messages.at(-1),/sesión autorizada/);

  context={...context,mode:'cloud'};
  load=async()=>[row('hidden','open',null,'p2')];
  await ask();
  assert.match(messages.at(-1),/No pude verificar/);
  assert.doesNotMatch(messages.at(-1),/hidden/);
 }finally{globalThis.document=prev;}
});

test('Miss discards replies if role downgraded, user changed, tenant changed or new question superseded it',async()=>{
 const prev=globalThis.document;
 globalThis.document={createElement:()=>({})};
 let context={project:{id:'p1'},projectId:'p1',userId:'u1',role:'admin',mode:'cloud',
  now:time,tickets:[],availablePages:['pqrs','meetings','tickets']};
 let submit,finish;
 const input={value:''},messages=[];
 const nodes={
  '.miss-chat-toggle':{addEventListener(){}},
  '.miss-chat-panel':{},
  '.miss-chat-messages':{append(node){if(String(node.className||'').includes('miss-chat-msg'))messages.push(node.textContent||'');}},
  form:{querySelector:()=>input,addEventListener(_,fn){submit=fn;}}
 };
 const host={isConnected:true,querySelector:k=>nodes[k],querySelectorAll:()=>[]};
 const ask=q=>{input.value=q;submit({preventDefault(){}});};
 try{
  mountMissAdphorChat(host,{context:()=>context,onNavigate(){},loadPqrs:()=>new Promise(resolve=>{finish=resolve;})});
  ask('PQRS pendientes');const count=messages.length;
  context={...context,role:'viewer'};
  finish(rows);await new Promise(resolve=>setImmediate(resolve));
  assert.equal(messages.length,count,'role downgrade');
  context={...context,role:'admin'};
  ask('PQRS pendientes');const count2=messages.length;
  context={...context,userId:'u2'};
  finish(rows);await new Promise(resolve=>setImmediate(resolve));
  assert.equal(messages.length,count2,'identity change');
  context={...context,userId:'u1'};
  ask('PQRS pendientes');const count3=messages.length;
  context={...context,projectId:'p2',project:{id:'p2'}};
  finish(rows);await new Promise(resolve=>setImmediate(resolve));
  assert.equal(messages.length,count3,'tenant change');
  context={...context,projectId:'p1',project:{id:'p1'}};
  ask('PQRS pendientes');
  ask('¿Cómo consulto PQRS?');
  const count4=messages.length;
  finish(rows);await new Promise(resolve=>setImmediate(resolve));
  assert.equal(messages.length,count4,'out-of-order response');
 }finally{globalThis.document=prev;}
});

test('New feature does not add network credentials or bypass the existing signed-in repo',()=>{
 const js=readFileSync(new URL('../src/js/ui-miss-adphor-chat.js',import.meta.url),'utf8');
 const logic=readFileSync(new URL('../src/js/services/miss-pqrs-status.js',import.meta.url),'utf8');
 assert.match(js,/data-miss-question="PQRS pendientes"/);
 assert.match(js,/summarizeMissPqrsStatus\(await loadPqrs\(current.projectId\)/);
 assert.match(js,/latest\.role!==current\.role/);
 assert.match(js,/questionNumber!==latestQuestion/);
 assert.doesNotMatch(logic,/fetch\(|service_role|refresh_token|localStorage/);
});
