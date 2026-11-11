import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {mountMissAdphorChat,answerMissAdphor,isPqrsAttentionQuestion,summarizePqrsAttention} from '../src/js/ui-miss-adphor-chat.js';
const context={project:{id:'p1',name:'QA Porto'},projectId:'p1',tickets:[{project_id:'p1',status:'Pendiente',priority:'Alta'},{project_id:'p2',status:'Pendiente',priority:'Urgente'}],role:'viewer',mode:'demo',availablePages:['tickets','pqrs','agent-history','recorridos','meetings','reports']};
test('read-only assistant only counts current authorized property',()=>{
 const a=answerMissAdphor('casos pendientes',context);
 assert.match(a.text,/1 casos visibles/);assert.equal(a.page,'tickets');
 assert.doesNotMatch(a.text,/p2/);
});
test('assistant refuses to approve, close, send or assign cases',()=>{
 for(const q of ['cerrar un caso','aprobar informe','enviar correo','asignar caso']) {
   const a=answerMissAdphor(q,context);
   assert.match(a.text,/no ejecuto/);assert.equal(a.page,null);
 }
});
test('assistant does not invent data when property scope invalid',()=>{
 const a=answerMissAdphor('casos pendientes',{...context,projectId:'p2'});
 assert.match(a.text,/Selecciona una copropiedad/);
});
test('assistant navigation limited to available pages, not arbitrary requests',()=>{
 const a=answerMissAdphor('reuniones',{...context,availablePages:['tickets']});
 assert.equal(a.page,null);
});
test('assistant mounted in signed-in portal and uses original portrait',()=>{
 const app=readFileSync(new URL('../src/js/app.js',import.meta.url),'utf8');
 assert.match(app,/mountMissAdphorChat/);assert.match(app,/miss-adphor-chat-root/);
 const ui=readFileSync(new URL('../src/js/ui-miss-adphor-chat.js',import.meta.url),'utf8');
 assert.match(ui,/assets\/branding\/miss-adphor\.webp/);
 assert.match(ui,/textContent=text/);
});

test('Miss ADPHOR does not reveal internal agent history to residents or viewers',()=>{
 const reply=answerMissAdphor('¿Qué hace el enjambre?',{...context,role:'viewer'});
 assert.equal(reply.page,null);
 assert.match(reply.text,/exclusivos de Administración y Coordinación/);
});
test('management may navigate to agent history but cannot automate decisions',()=>{
 const reply=answerMissAdphor('Miss ADPHOR y el enjambre',{...context,role:'admin'});
 assert.equal(reply.page,'agent-history');
 assert.match(reply.text,/no hay un modelo entrenado validado/);
});
test('role-specific guidance avoids unsupported resident records',()=>{
 const reply=answerMissAdphor('soy copropietario',{...context,role:'viewer'});
 assert.equal(reply.page,null);
 assert.match(reply.text,/sesión tenga autorizadas/);
});

test('Atención hoy accepts the direct question and quick action',()=>{
 assert.equal(isPqrsAttentionQuestion('Miss ADPHOR, ¿qué asuntos requieren mi atención hoy?'),true);
 assert.equal(isPqrsAttentionQuestion('¿Qué asuntos importantes requieren mi atención hoy?'),true);
 assert.equal(isPqrsAttentionQuestion('¿Qué asuntos requieren atención en otra copropiedad?'),false);
});

test('Atención hoy excludes closed cases, invalid deadlines and other properties',()=>{
 const past='2026-11-08T00:00:00Z';
 const rows=[
  {id:'case-1',project_id:'p1',status:'open',due_at:past},
  {project_id:'p1',status:'assigned',due_at:'invalid'},
  {project_id:'p1',status:'closed',due_at:past},
  {project_id:'p2',status:'in_progress',due_at:past}
 ];
 assert.deepEqual(summarizePqrsAttention(rows,'p1',Date.parse('2026-11-09T00:00:00Z')),{open:1,inProgress:1,overdue:1,overdueIds:['case-1']});
});

test('verified meetings handle tenant, empty results, errors and stale views', async () => {
 const previousDocument = globalThis.document;
 globalThis.document = {createElement: () => ({})};
 try {
  const messages = [];
  let submit;
  let active = context;
  let loadMeetings;
  const input = {value: ''};
  const nodes = {
   '.miss-chat-toggle': {addEventListener() {}},
   '.miss-chat-panel': {},
   '.miss-chat-messages': {append(node) { messages.push(node.textContent); }},
   'form': {querySelector: () => input, addEventListener(_, callback) { submit = callback; }}
  };
  const host = {isConnected: true, querySelector: key => nodes[key], querySelectorAll: () => []};
  mountMissAdphorChat(host, {
   context: () => active, onNavigate() {},
   loadMeetings: project => loadMeetings(project)
  });
  async function ask() {
   input.value = '¿Qué reuniones verificadas tiene esta copropiedad?';
   submit({preventDefault() {}});
   await new Promise(resolve => setImmediate(resolve));
  }
  const meeting = {project_id:'p1',title:'Consejo autorizado',start_at:'2026-11-09T14:00:00Z',
   is_calendar_verified:true,source_status:'Confirmada'};
  loadMeetings = async project => {
   assert.equal(project,'p1');
   return [meeting,{...meeting,project_id:'p2',title:'Reunión ajena'}];
  };
  await ask();
  assert.match(messages.join(' '), /Consejo autorizado.*importación puntual/);
  assert.doesNotMatch(messages.join(' '), /Reunión ajena/);

  loadMeetings = async () => [];
  await ask();
  assert.match(messages.join(' '), /No hay reuniones verificadas/);

  loadMeetings = async () => { throw Error('detalle interno'); };
  await ask();
  assert.match(messages.at(-1), /No pude verificar/);
  assert.doesNotMatch(messages.join(' '), /detalle interno/);

  let resolve;
  loadMeetings = () => new Promise(done => { resolve = done; });
  await ask();
  const count = messages.length;
  active = {...context,projectId:'p2'};
  resolve([meeting]);
  await new Promise(done => setImmediate(done));
  assert.equal(messages.length,count);
 } finally {
  globalThis.document = previousDocument;
 }
});

test('contextual guidance uses only the current visible module and authorized property',()=>{
 const question='¿Cómo uso este módulo?';
 const meetings={...context,page:'meetings'};
 assert.match(answerMissAdphor(question,meetings).text,/Sin acompañamiento requerido/);
 assert.match(answerMissAdphor(question,{...meetings,availablePages:[]}).text,/módulo visible/);
 assert.match(answerMissAdphor(question,{...meetings,projectId:'other'}).text,/copropiedad autorizada/);
 assert.equal(answerMissAdphor(question,meetings).page,null);
});


test('Miss overdue counts follow the Colombia day across UTC midnight',()=>{
 const ctx={...context,now:Date.parse('2026-11-12T02:00:00Z'),tickets:[
  {project_id:'p1',status:'open',due_date:'2026-11-11'},
  {project_id:'p1',status:'open',due_date:'2026-11-10'},
  {project_id:'p1',status:'closed',due_date:'2026-11-09'},
  {project_id:'p2',status:'open',due_date:'2026-11-09'}]};
 assert.match(answerMissAdphor('casos pendientes',ctx).text,/1 con fecha vencida/);
 assert.match(answerMissAdphor('casos pendientes',{...ctx,now:Date.parse('2026-11-12T05:00:00Z')}).text,/2 con fecha vencida/);
});

test('Miss rejects impossible date-only deadlines',async()=>{
 const {isPastBogotaDay}=await import('../src/js/ui-miss-adphor-chat.js');
 for(const value of ['2026-02-30','2026-13-01','invalid',null])assert.equal(isPastBogotaDay(value,Date.parse('2026-11-12T12:00:00Z')),false);
 assert.equal(isPastBogotaDay('2024-02-29',Date.parse('2026-11-12T12:00:00Z')),true);
});

test('Miss meeting evidence is scoped, confirmed, ordered and does not mutate source',async()=>{
 const {verifiedMissMeetings}=await import('../src/js/ui-miss-adphor-chat.js');
 const later={project_id:'p1',title:'Tarde',start_at:'2026-11-12T19:00:00Z',is_calendar_verified:true,source_status:'Confirmada'};
 const earlier={...later,title:'Temprano',start_at:'2026-11-12T14:00:00Z'};
 const rows=[later,{...earlier,project_id:'p2'},earlier,{...later,source_status:'Cancelada'},null];
 assert.deepEqual(verifiedMissMeetings(rows,'p1'),[earlier,later]);
 assert.equal(rows[0],later);
 for(const invalid of [null,{},[{...later,start_at:'invalid'}]] )assert.throws(()=>verifiedMissMeetings(invalid,'p1'));
 assert.throws(()=>verifiedMissMeetings(rows,''));
});
