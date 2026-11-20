import test from 'node:test';
import assert from 'node:assert/strict';
import {qaDiagnosticAllowed,runQaDiagnosticAgents,QA_DIAGNOSTIC_HOST} from '../src/js/services/qa-diagnostic-agents.js';

const setup=()=>({
 hostname:QA_DIAGNOSTIC_HOST,mode:'cloud',role:'admin',
 userId:'user-qa',projectId:'source-1',authorizedProjects:['source-1'],
 corporateAdmin:true,tickets:[{id:'case1',project_id:'source-1',status:'Pendiente',assignee:null}],
 availablePages:['agent-history','pqrs','meetings','visits'],missReady:true,
 repo:{
  agentReadiness:async()=>({registry_ready:true,rules_ready:false,reviews_ready:false,models_ready:false}),
  corporateStaffDirectory:async()=>[{active:true,photo_path:'private.jpg'},{active:true,photo_path:null}]
 }
});
test('authenticated QA observers inspect read-only state, honestly report disabled ML/DL/PLN',async()=>{
 const steps=[];const report=await runQaDiagnosticAgents(setup(),{now:()=> '2026-11-20T14:00:00Z',onStep:s=>steps.push(s)});
 assert.equal(report.mode,'diagnostico_qa_solo_lectura');
 assert.equal(steps.length,6);
 assert.equal(steps[0].status,'ok');
 assert.equal(steps[1].status,'attention');
 assert.equal(steps[2].status,'attention');
 assert.equal(steps[3].status,'ok');
 assert.equal(steps[4].status,'ok');
 assert.equal(steps[5].status,'blocked');
 assert.match(steps[5].detail,/deshabilitados/);
 assert.equal(steps.every(s=>s.checkedAt==='2026-11-20T14:00:00Z'),true);
 assert.doesNotMatch(JSON.stringify(report),/private.jpg|user-qa|case1/);
});
test('invalid hostname, non-admin, foreign project, demo, missing identity: zero data calls',async()=>{
 for(const patch of [{hostname:'adphor-platform.pages.dev'},{role:'viewer'},{projectId:'other'},
   {mode:'demo'},{userId:''},{authorizedProjects:['source-2']}]){
   let calls=0;const ctx={...setup(),...patch,repo:{
     agentReadiness:async()=>{calls++;throw Error('Never call');},
     corporateStaffDirectory:async()=>{calls++;throw Error('Never call');}
   }};
   assert.equal(qaDiagnosticAllowed(ctx),false);
   const r=await runQaDiagnosticAgents(ctx);
   assert.equal(r.steps.length,1);assert.equal(r.steps[0].status,'blocked');
   assert.equal(calls,0);
 }
});
test('denied AAL2 stops all further probes before private staff reads',async()=>{
 let staff=0;const ctx={...setup(),repo:{
   agentReadiness:async()=>{throw Error('AAL1');},
   corporateStaffDirectory:async()=>{staff++;return [];}
 }};
 const r=await runQaDiagnosticAgents(ctx);
 assert.deepEqual(r.steps.map(s=>s.id),['acceso']);
 assert.equal(r.steps[0].status,'blocked');assert.equal(staff,0);
});
test('foreign tenant cases are flagged, no approval, sending, uploads or writes',async()=>{
 const calls=[];const ctx={...setup(),tickets:[
   {id:'x',project_id:'other',status:'Pendiente'},
   {id:'y',project_id:'source-1',status:'En proceso',assignee:'operator'}
 ],repo:{
  agentReadiness:async()=>({registry_ready:true,rules_ready:false,models_ready:false}),
  corporateStaffDirectory:async()=>[],
  runAgentRules:()=>calls.push('run'),
  reviewAgentRun:()=>calls.push('approve'),
  sendEmail:()=>calls.push('send'),
  upload:()=>calls.push('upload')
 }};
 const r=await runQaDiagnosticAgents(ctx);
 assert.equal(r.steps.find(x=>x.id==='operaciones').status,'attention');
 assert.deepEqual(calls,[]);
});
test('coordinator sees permitted diagnostics but no corporate administrator data',async()=>{
 let staff=0;const c={...setup(),role:'coordinator',corporateAdmin:false,repo:{
  agentReadiness:async()=>({registry_ready:true,rules_ready:false,models_ready:false}),
  corporateStaffDirectory:async()=>{staff++;return [];}
 }};
 const r=await runQaDiagnosticAgents(c);
 assert.equal(r.steps.find(x=>x.id==='equipo').status,'blocked');
 assert.equal(staff,0);
});
