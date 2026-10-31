import test from 'node:test';import assert from 'node:assert/strict';
import {createPrivateEvidenceRepository} from '../src/js/services/private-evidence-repository.js';
test('requires verified private storage acknowledgement with matching tenant and case',async()=>{
 const file={name:'qa.jpg',type:'image/jpeg',size:10};
 const api={putCaseEvidence:async()=>({id:'e1',project_id:'p1',case_id:'c1',visibility:'private'})};
 const repo=createPrivateEvidenceRepository(api);
 const a=await repo.uploadEvidence({projectId:'p1',caseId:'c1',kind:'pqrs',files:[file]});
 assert.equal(a[0].id,'e1');assert.equal(a[0].visibility,'private');
});
test('rejects public or wrong-property response',async()=>{
 const repo=createPrivateEvidenceRepository({putCaseEvidence:async()=>({id:'e1',project_id:'p2',case_id:'c1',visibility:'public'})});
 await assert.rejects(repo.uploadEvidence({projectId:'p1',caseId:'c1',kind:'pqrs',files:[{}]}),/Confirmación inválida: 0 de 1 archivos confirmados/);
});
test('without API integration, fail closed',()=>{
 assert.throws(()=>createPrivateEvidenceRepository({}),/no disponible/);
});

test('partial uploads report confirmed count instead of claiming all-or-nothing',async()=>{
 let calls=0;
 const api={putCaseEvidence:async()=>{calls++;if(calls===2)throw Error('network');return {id:'e1',project_id:'p1',case_id:'c1',visibility:'private'};}};
 const repo=createPrivateEvidenceRepository(api);
 await assert.rejects(repo.uploadEvidence({projectId:'p1',caseId:'c1',kind:'pqrs',files:[{},{}]}),/1 de 2 archivos confirmados/);
 assert.equal(calls,2);
});
test('invalid acknowledgment after prior successful upload warns user to check before retry',async()=>{
 let calls=0;
 const api={putCaseEvidence:async()=>{calls++;return calls===1?{id:'e1',project_id:'p1',case_id:'c1',visibility:'private'}:{id:'e2',project_id:'p2',case_id:'c1',visibility:'private'};}};
 const repo=createPrivateEvidenceRepository(api);
 await assert.rejects(repo.uploadEvidence({projectId:'p1',caseId:'c1',kind:'pqrs',files:[{},{}]}),/1 de 2 archivos confirmados/);
});
