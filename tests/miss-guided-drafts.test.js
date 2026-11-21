import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {missTaskPlan,missTaskList,missTaskIntent,missPqrsDraftFromText} from '../src/js/services/miss-task-actions.js';
import {answerMissAdphor} from '../src/js/ui-miss-adphor-chat.js';

const ctx={mode:'cloud',userId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',role:'admin',
 projectId:'source-1',project:{id:'source-1',name:'Edificio QA'},tickets:[],
 availablePages:['dashboard','pqrs','visits','recorridos','meetings','reports']};
test('Miss starts authorized human-reviewed forms only',()=>{
 for(const [id,page] of [['pqrs','pqrs'],['visit','visits'],['incident','recorridos'],
  ['meeting','meetings'],['weekly','reports']]){
  const result=missTaskPlan(ctx,id);
  assert.equal(result.ok,true,id);
  assert.equal(result.page,page);
  assert.equal(result.requiresHumanConfirmation,true);
  assert.equal(result.externalEffect,false);
 }
});
test('Miss refuses demo, anonymous actor, wrong tenant, hidden module and unauthorized role',()=>{
 for(const patch of [{mode:'demo'},{userId:''},{project:{id:'source-2'}},
  {projectId:'source-2'},{availablePages:['dashboard']}])
  assert.equal(missTaskPlan({...ctx,...patch},'pqrs').ok,false);
 for(const role of ['viewer','technician']){
  assert.equal(missTaskPlan({...ctx,role},'visit').ok,false);
  assert.equal(missTaskPlan({...ctx,role},'weekly').ok,false);
 }
 assert.equal(missTaskPlan({...ctx,role:'viewer'},'pqrs').ok,true);
 assert.equal(missTaskPlan(ctx,'destroy').ok,false);
});
test('Miss document feature is advertised as pending, not mistaken for an active inbox',()=>{
 const rows=missTaskList(ctx,{documentsEnabled:false});
 assert.equal(rows.find(x=>x.id==='document').enabled,false);
 assert.equal(missTaskPlan({...ctx,availablePages:[...ctx.availablePages,'miss-documents']},'document',{documentsEnabled:false}).ok,false);
});
test('Miss recognizes deliberate user requests but preserves informational guidance',()=>{
 for(const [q,id] of [['Radicar una PQRS: fuga de agua en portería','pqrs'],
  ['programar una visita','visit'],['registrar una novedad','incident'],
  ['solicitar una reunión','meeting'],['generar informe gerencial semanal','weekly']])
   assert.equal(missTaskIntent(q),id,q);
 for(const q of ['Cómo agendar una reunión','cuándo puedo preparar una visita',
  'cerrar un caso','aprobar informe','enviar correo'])assert.equal(missTaskIntent(q),null,q);
 const info=answerMissAdphor('¿Cómo agendar una reunión?',{...ctx,userId:undefined});
 assert.match(info.text,/no crea ni confirma reservas/);
 const blocked=answerMissAdphor('programar una visita',{...ctx,role:'viewer'});
 assert.equal(blocked.page,null);
 assert.match(blocked.text,/Tu rol no permite/);
});
test('Miss extracts only explicit, bounded PQRS text and leaves final decision to user',()=>{
 const text='Radicar una PQRS por fuga de agua en la entrada del edificio';
 const draft=missPqrsDraftFromText(text);
 assert.deepEqual(draft,{subject:'fuga de agua en la entrada del edificio',description:'fuga de agua en la entrada del edificio'});
 assert.equal(Object.isFrozen(draft),true);
 const result=answerMissAdphor(text,ctx);
 assert.equal(result.page,'pqrs');
 assert.equal(result.task,'pqrs');
 assert.equal(result.draft.projectId,'source-1');
 assert.equal(result.draft.userId,ctx.userId);
 assert.match(result.text,/revísalos y edítalos/);
 for(const q of ['Radicar una PQRS','Cómo radicar una PQRS','Radicar una PQRS: corta',
  'Radicar una PQRS: <script>alert(1)</script>',
  'Radicar una PQRS: '.concat('a'.repeat(400))])assert.equal(missPqrsDraftFromText(q),null);
});
test('Miss UI routes only to existing forms and scopes draft to actor and property',()=>{
 const app=readFileSync(new URL('../src/js/app.js',import.meta.url),'utf8');
 const hub=readFileSync(new URL('../src/js/ui-miss-task-hub.js',import.meta.url),'utf8');
 const chat=readFileSync(new URL('../src/js/ui-miss-adphor-chat.js',import.meta.url),'utf8');
 const css=readFileSync(new URL('../src/css/premium.css',import.meta.url),'utf8');
 assert.match(app,/draft\?\.projectId===state\.projectId/);
 assert.match(app,/draft\?\.userId===state\.user\?\.id/);
 assert.match(app,/draft\?\.role===role\(\)/);
 assert.match(app,/field\.value=draft\.subject/);
 assert.match(app,/desc\.value=draft\.description/);
 assert.match(app,/if\(task\)\{/);
 assert.match(hub,/missTaskPlan\(context\(\),task\.id/);
 assert.doesNotMatch(hub,/\.submit\(|fetch\(|localStorage|innerHTML\s*=/);
 assert.match(chat,/mountMissTaskHub\(panel/);
 assert.match(css,/max-height:min\(77dvh/);
});
