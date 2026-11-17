import test from 'node:test';
import assert from 'node:assert/strict';
import {QA_URL} from '../src/js/services/qa-auth-policy.js';
import {qaAgentRegistryReadiness,qaAgentRuns,qaAgentRunDetail,validateQaAgentRows} from '../src/js/services/qa-agent-registry.js';
import {mountAgentHistory,draftCard} from '../src/js/ui-agent-history.js';
const ID='12345678-1234-4123-8123-123456789abc',PROJECT='demo-01';
const run={id:ID,project_id:PROJECT,source_read_at:'2026-11-17T18:00:00Z',engine_kind:'rules',
 status:'Pendiente de aprobación del administrador',draft:'<script>alert(1)</script>',result_hash:'a'.repeat(64)};
function fixture({aal='aal2',rows=[],error=null,identity=true}={}){
 const calls=[];
 const chain={
   select(fields){calls.push(['select',fields]);return chain;},
   eq(field,value){calls.push(['eq',field,value]);return chain;},
   order(field,opts){calls.push(['order',field,opts.ascending]);return chain;},
   limit(n){calls.push(['limit',n]);return Promise.resolve({data:rows,error});},
   range(start,end){calls.push(['range',start,end]);return Promise.resolve({data:rows,error});},
   maybeSingle(){calls.push('maybeSingle');return Promise.resolve({data:rows[0]??null,error});},
 };
 const client={auth:{
    async getUser(){calls.push('user');return{data:{user:identity?{id:'test-user'}:null},error:null};},
    mfa:{async getAuthenticatorAssuranceLevel(){calls.push('mfa');return{data:{currentLevel:aal},error:null};}},
   },from(table){calls.push(['from',table]);assert.equal(table,'agent_run_status');return chain;}};
 return {client,calls};
}
test('QA registry preflight is authenticated and always read-only',async()=>{
 const {client,calls}=fixture();
 const result=await qaAgentRegistryReadiness(client,{qaUrl:QA_URL,projectId:PROJECT});
 assert.equal(result.registry_ready,true);
 assert.equal(result.rules_ready,false);
 assert.equal(result.reviews_ready,false);
 assert.equal(result.models_ready,false);
 assert.equal(Object.isFrozen(result),true);
 assert.deepEqual(calls.filter(x=>Array.isArray(x)&&x[0]==='eq'),[['eq','project_id',PROJECT]]);
});
test('QA history limits columns, page size and scoped tenant',async()=>{
 const {client,calls}=fixture({rows:[run]});
 const rows=await qaAgentRuns(client,{qaUrl:QA_URL,projectId:PROJECT,offset:20});
 assert.equal(rows.length,1);
 assert.deepEqual(calls.find(x=>x[0]==='range'),['range',20,39]);
 assert.doesNotMatch(calls.find(x=>x[0]==='select')[1],/source_snapshot|password|private/i);
 assert.deepEqual(calls.filter(x=>x[0]==='eq'),[['eq','project_id',PROJECT]]);
});
test('QA detail reads only scoped UUID and output escapes HTML',async()=>{
 const {client,calls}=fixture({rows:[run]});
 const data=await qaAgentRunDetail(client,{qaUrl:QA_URL,projectId:PROJECT,runId:ID});
 assert.deepEqual(calls.filter(x=>x[0]==='eq'),[['eq','project_id',PROJECT],['eq','id',ID]]);
 assert.doesNotMatch(draftCard(data,false),/<script>/);
});
test('AAL1, production URL and invalid tenant are blocked before querying',async()=>{
 for(const state of [{aal:'aal1'},{identity:false}]){
   const {client,calls}=fixture(state);
   await assert.rejects(qaAgentRuns(client,{qaUrl:QA_URL,projectId:PROJECT}),/MFA AAL2|iniciar sesión/);
   assert.equal(calls.some(x=>x[0]==='from'),false);
 }
 const {client,calls}=fixture();
 await assert.rejects(qaAgentRuns(client,{qaUrl:'https://oqizvirqjwbbhyyjpthq.supabase.co',projectId:PROJECT}),/solo permite/);
 await assert.rejects(qaAgentRuns(client,{qaUrl:QA_URL,projectId:'../other'}),/copropiedad válida/);
 await assert.rejects(qaAgentRunDetail(client,{qaUrl:QA_URL,projectId:PROJECT,runId:'../other'}),/identificador/);
 assert.equal(calls.some(x=>x[0]==='from'),false);
});
test('foreign rows, forged status, invalid schema and failed provider cannot pass',async()=>{
 await assert.rejects(qaAgentRuns(fixture({rows:[{...run,project_id:'another'}]}).client,{qaUrl:QA_URL,projectId:PROJECT}),/otra copropiedad/);
 assert.throws(()=>validateQaAgentRows([{...run,status:'fake approved'}],PROJECT),/inconsistentes/);
 assert.throws(()=>validateQaAgentRows([{...run,id:'bad'}],PROJECT),/inconsistentes/);
 await assert.rejects(qaAgentRegistryReadiness(fixture({error:{message:'private provider details'}}).client,{qaUrl:QA_URL,projectId:PROJECT}),/registro protegido/);
});
test('UI offers only list, never run or approval, in direct registry mode',async()=>{
 const container={innerHTML:'',isConnected:true,addEventListener(){}};
 const repo={agentApiConfigured:false,agentRegistryReadOnlyEnabled:true,
   agentRuns:async()=>[],agentReadiness:async()=>({registry_ready:true,reviews_ready:false,rules_ready:false})};
 await mountAgentHistory(container,{repo,projectId:PROJECT,role:'admin'});
 assert.match(container.innerHTML,/Solo lectura/);
 assert.match(container.innerHTML,/data-history="load"/);
 assert.doesNotMatch(container.innerHTML,/data-history="(?:run|approve|reject)"/);
});
