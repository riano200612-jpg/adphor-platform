import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {missTaskPlan,missTaskList,missTaskIntent} from '../src/js/services/miss-task-actions.js';
import {answerMissAdphor} from '../src/js/ui-miss-adphor-chat.js';

const pages=['dashboard','pqrs','visits','recorridos','meetings','reports','miss-documents'];
const context={mode:'cloud',userId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 role:'admin',projectId:'source-1',project:{id:'source-1',name:'Edificio QA'},
 availablePages:pages,documentsEnabled:true,tickets:[]};
test('Miss actions route to existing user-reviewed forms without independent writes',()=>{
 for(const [id,page] of [['pqrs','pqrs'],['visit','visits'],['incident','recorridos'],
  ['meeting','meetings'],['weekly','reports'],['document','miss-documents']]){
  const plan=missTaskPlan(context,id,{documentsEnabled:true});
  assert.equal(plan.ok,true,id);
  assert.equal(plan.page,page,id);
  assert.equal(plan.externalEffect,false);
  assert.equal(plan.requiresHumanConfirmation,true);
  assert.doesNotMatch(plan.message,/ya (?:registré|envié|aprobé)/i);
 }
});
test('Miss actions deny demo, missing user, property mismatch, unauthorized modules and unauthorized roles',()=>{
 for(const override of [{mode:'demo'},{userId:''},{project:{id:'source-2'}},
  {projectId:'source-2'},{availablePages:['dashboard']}])
  assert.equal(missTaskPlan({...context,...override},'visit').ok,false);
 for(const role of ['viewer','technician']){
  assert.equal(missTaskPlan({...context,role},'visit').ok,false);
  assert.equal(missTaskPlan({...context,role},'weekly').ok,false);
 }
 assert.equal(missTaskPlan({...context,role:'viewer'},'pqrs').ok,true);
 assert.equal(missTaskPlan({...context,role:'viewer'},'meeting').ok,true);
 assert.equal(missTaskPlan({...context,role:'viewer'},'document',{documentsEnabled:true}).ok,true);
 assert.equal(missTaskPlan({...context,role:'viewer'},'incident').ok,false);
 assert.equal(missTaskPlan(context,'destroy').ok,false);
});
test('Miss document upload cannot start before the QA release gate',()=>{
 assert.equal(missTaskPlan(context,'document',{documentsEnabled:false}).ok,false);
 const advertised=missTaskList(context,{documentsEnabled:false});
 assert.equal(advertised.find(a=>a.id==='document').enabled,false);
 assert.equal(advertised.find(a=>a.id==='pqrs').enabled,true);
 assert.equal(missTaskPlan({...context,availablePages:['pqrs']},'document',{documentsEnabled:true}).ok,false);
});
test('Miss understands clear user-initiated tasks while rejecting unauthorized autonomous commands',()=>{
 const examples=[
 ['Radicar PQRS de filtración','pqrs'],
 ['programar una visita','visit'],
 ['Registrar una novedad','incident'],
 ['solicitar una reunión','meeting'],
 ['generar informe gerencial semanal','weekly'],
 ['subir un documento','document']
 ];
 for(const [query,id] of examples)assert.equal(missTaskIntent(query),id,query);
 for(const q of ['cerrar un caso','aprobar un informe','enviar todos los documentos','borrar archivos',
  'asignar un caso','subir contraseñas'])assert.equal(missTaskIntent(q),null,q);
 const response=answerMissAdphor('subir un documento',context);
 assert.equal(response.task,'document');
 assert.equal(response.page,'miss-documents');
 assert.match(response.text,/cuarentena/);
 const blocked=answerMissAdphor('programar una visita',{...context,role:'viewer'});
 assert.equal(blocked.page,null);
 assert.match(blocked.text,/Tu rol no permite/);
});
test('Miss mobile compact action hub exposes existing workflow only; no submit or raw HTML injection',()=>{
 const hub=readFileSync(new URL('../src/js/ui-miss-task-hub.js',import.meta.url),'utf8');
 const app=readFileSync(new URL('../src/js/app.js',import.meta.url),'utf8');
 const css=readFileSync(new URL('../src/css/premium.css',import.meta.url),'utf8');
 assert.match(hub,/missTaskPlan\(context\(\),task\.id/);
 assert.match(hub,/onNavigate\(decision\.page,decision\.id\)/);
 assert.match(hub,/Consultas rápidas y guías/);
 assert.doesNotMatch(hub,/[.]submit\(|service_role|fetch\(|localStorage|innerHTML\s*=/);
 assert.match(app,/const routes=\{pqrs:'pqrs',visit:'visits',incident:'recorridos'/);
 assert.match(app,/if\(task && routes\[task\]!==page\)return/);
 assert.match(css,/max-height:min\(77dvh/);
 assert.match(css,/miss-task-grid/);
});
