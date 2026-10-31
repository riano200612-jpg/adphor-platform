import test from 'node:test';import assert from 'node:assert/strict';
import {createEvidenceUploadPlan,uploadPrivateEvidence} from '../src/js/services/private-evidence.js';
const file={name:'evidencia.webp',type:'image/webp',size:100};
test('private upload contract keeps case and tenant association',()=>{
 const plan=createEvidenceUploadPlan({projectId:'p1',caseId:'case1',files:[file]});
 assert.equal(plan[0].project_id,'p1');assert.equal(plan[0].case_id,'case1');
 assert.equal(plan[0].status,'awaiting_private_upload');
});
test('no storage provider means no upload and clear error',async()=>{
 await assert.rejects(uploadPrivateEvidence({repository:{},projectId:'p1',caseId:'c1',files:[file]}),/no configurado/);
});
test('invalid scope, formats, and case type rejected',()=>{
 assert.throws(()=>createEvidenceUploadPlan({projectId:'',caseId:'c1',files:[file]}));
 assert.throws(()=>createEvidenceUploadPlan({projectId:'p1',caseId:'c1',kind:'other',files:[file]}));
 assert.throws(()=>createEvidenceUploadPlan({projectId:'p1',caseId:'c1',files:[{...file,type:'text/html'}]}));
});
