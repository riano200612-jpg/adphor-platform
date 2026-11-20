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

test('partial acknowledgements never count as full private upload',async()=>{
 const repo={uploadEvidence:async()=>[{id:'e1',project_id:'p1',case_id:'c1',visibility:'private',storage_written:true,metadata_linked:true}]};
 await assert.rejects(uploadPrivateEvidence({repository:repo,projectId:'p1',caseId:'c1',files:[file,file]}),/asociación privada/);
});
test('public, wrong-tenant, storage-only and metadata-only receipts fail closed',async()=>{
 const cases=[
  {id:'a',project_id:'other',case_id:'c1',visibility:'private',storage_written:true,metadata_linked:true},
  {id:'a',project_id:'p1',case_id:'c1',visibility:'public',storage_written:true,metadata_linked:true},
  {id:'a',project_id:'p1',case_id:'c1',visibility:'private',storage_written:false,metadata_linked:true},
  {id:'a',project_id:'p1',case_id:'c1',visibility:'private',storage_written:true,metadata_linked:false}
 ];
 for(const candidate of cases)
  await assert.rejects(uploadPrivateEvidence({repository:{uploadEvidence:async()=>[candidate]},projectId:'p1',caseId:'c1',files:[file]}),/asociación privada/);
});
test('forward progress only as an observation; verify final receipts',async()=>{
 const progress=[];
 const receipt={id:'ok',project_id:'p1',case_id:'c1',visibility:'private',storage_written:true,metadata_linked:true};
 const repo={uploadEvidence:async({onProgress})=>{onProgress({completed:1,total:1});return [receipt]}};
 const result=await uploadPrivateEvidence({repository:repo,projectId:'p1',caseId:'c1',files:[file],onProgress:s=>progress.push(s)});
 assert.deepEqual(result,[receipt]);assert.deepEqual(progress,[{completed:1,total:1}]);
});
