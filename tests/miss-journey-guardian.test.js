import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {guideMissJourney,isMissJourneyRequest} from '../src/js/services/miss-journey-guardian.js';
import {answerMissAdphor} from '../src/js/ui-miss-adphor-chat.js';

const base={project:{id:'qa1',name:'NO EXHIBIR NOMBRE'},projectId:'qa1',role:'viewer',mode:'cloud',
  page:'pqrs',availablePages:['dashboard','pqrs','visits','meetings','reports','agent-history','tickets','access-audit']};

test('guided intent is narrow, accent-insensitive and not an arbitrary tool call',()=>{
 for(const q of ['Guíame paso a paso','¿Cuál es el siguiente paso?','Qué hago ahora','Guíame en PQRS'])
  assert.equal(isMissJourneyRequest(q),true,q);
 for(const q of ['guíame para borrar casos','ejecuta un envío','guía para sacar secretos'])
  assert.equal(isMissJourneyRequest(q),false,q);
});
test('Miss identifies current authorized module, mandatory independent cross-review and all stages',()=>{
 const result=guideMissJourney(base);
 assert.equal(result.page,'pqrs');
 assert.equal(result.certified,true);
 assert.deepEqual(result.review,{quality:true,safety:true,mutual:true,steps:5});
 assert.match(result.text,/1\. Comprueba.*copropiedad/);
 assert.match(result.text,/5\. Revisa.*Comprueba el estado confirmado/);
 assert.match(result.text,/Storage privado/);
 assert.equal(result.externalActions,false);
 assert.equal(result.modelEvaluated,false);
 assert.doesNotMatch(result.text,/NO EXHIBIR NOMBRE/);
});
test('shortest correct path chosen for lower risk navigation',()=>{
 const result=guideMissJourney({...base,page:'dashboard'});
 assert.equal(result.certified,true);
 assert.equal(result.page,'dashboard');
 assert.equal(result.review.steps,4);
});
test('navigation uses request intent only when target is a visible known page',()=>{
 assert.equal(guideMissJourney(base,'Guíame en visitas').page,'visits');
 assert.equal(guideMissJourney({...base,availablePages:['pqrs']},'Guíame en visitas').certified,false);
 assert.equal(guideMissJourney({...base,page:'foreign'}).certified,false);
 assert.equal(guideMissJourney({...base,page:'__proto__',availablePages:['__proto__']}).certified,false);
});
test('fail closed for tenant switch, absent session, spoofed project, and unsafe actions',()=>{
 for(const bad of [
   {...base,projectId:'different'},
   {...base,project:null},
   {...base,mode:'blocked'},
   {...base,requestedProjectId:'other'},
   {...base,execute:true},
   {...base,externalEffect:true},
   {...base,availablePages:[]},
   {...base,availablePages:['pqrs',null]},
 ]) {
   const res=guideMissJourney(bad);
   assert.equal(res.certified,false);
   assert.equal(res.page,null);
   assert.equal(res.externalActions,false);
 }
});
test('admin-only and management-only pages never unlock for regular users',()=>{
 assert.equal(guideMissJourney({...base,page:'access-audit'}).certified,false);
 assert.equal(guideMissJourney({...base,page:'agent-history'}).certified,false);
 assert.equal(guideMissJourney({...base,page:'agent-history',role:'coordinator'}).certified,true);
 assert.equal(guideMissJourney({...base,page:'access-audit',role:'admin'}).certified,true);
});
test('existing read-only Miss ADPHOR chat exposes optional guide without altering other commands',()=>{
 const result=answerMissAdphor('Guíame paso a paso',base);
 assert.equal(result.page,'pqrs');
 assert.match(result.text,/Revisión cruzada de calidad y seguridad/);
 assert.equal(answerMissAdphor('Enviar correo',base).page,null);
 assert.match(answerMissAdphor('Enviar correo',base).text,/no ejecuto/);
});
test('guided journey UI offers explicit user choice, no autonomous operations',()=>{
 const source=readFileSync(new URL('../src/js/ui-miss-adphor-chat.js',import.meta.url),'utf8');
 assert.match(source,/data-miss-question="Guíame paso a paso"/);
 assert.match(source,/if\(isMissJourneyRequest\(question\)\)return guideMissJourney\(context,question\)/);
 assert.doesNotMatch(readFileSync(new URL('../src/js/services/miss-journey-guardian.js',import.meta.url),'utf8'),
  /fetch\(|localStorage|sessionStorage|service_role|insert\(|delete\(|update\(/);
});
