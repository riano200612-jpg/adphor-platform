import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateQaCaseEvidenceRow} from '../src/js/services/qa-case-evidence.js';
const project='source-1',caseId='a330278f-54b4-41e6-89a1-805086ec3df4';
const actor='ff29397f-a90b-47ad-97ab-a299dfcbdd66';
const id='a330278f-54b4-81e6-89a1-805086ec3df4';
const expectedPath=[project,'pqrs',caseId,actor,id+'.pdf'].join('/');
const valid={id,project_id:project,case_id:caseId,uploaded_by:actor,
 storage_bucket:'qa-case-evidence',storage_path:expectedPath,
 media_type:'application/pdf',file_bytes:128,created_at:'2026-11-20T12:00:00Z'};
test('exact private evidence path accepted only for the intended case',()=>{
 assert.deepEqual(validateQaCaseEvidenceRow(valid,project,caseId),valid);
 assert.throws(()=>validateQaCaseEvidenceRow(valid,'source-2',caseId));
 assert.throws(()=>validateQaCaseEvidenceRow(valid,project,'b330278f-54b4-41e6-89a1-805086ec3df4'));
});
test('falsified owner, path, size, MIME and duplicate-looking suffix are rejected',()=>{
 for(const changed of [
 {uploaded_by:'b330278f-54b4-41e6-89a1-805086ec3df4'},
 {storage_path:expectedPath+'-tampered'},
 {storage_path:expectedPath+'/second.pdf'},
 {storage_path:expectedPath.replace(actor,'other-user')},
 {storage_bucket:'public'},
 {media_type:'image/jpeg'},{media_type:'text/html'},
 {file_bytes:0},{file_bytes:20971521},{file_bytes:'bad'},
 {id:'not-a-uuid'},{uploaded_by:null}
 ])assert.throws(()=>validateQaCaseEvidenceRow({...valid,...changed},project,caseId));
});
test('listing and signing must use full paths and validate the returned signed path',()=>{
 const src=readFileSync(new URL('../src/js/services/qa-case-evidence.js',import.meta.url),'utf8');
 assert.match(src,/rows\.map\(row=>validateQaCaseEvidenceRow\(row,projectId,caseId\)\)/);
 assert.match(src,/validateQaCaseEvidenceRow\(rows\[0\],projectId,caseId\)/);
 assert.ok(src.includes("url.pathname!=='/storage/v1/object/sign/'+BUCKET+'/'+row.storage_path"));
 assert.ok(!src.includes("url.pathname.startsWith('/storage/v1/object/sign/'"));
});

test('runtime refuses signed URLs for a different file even within the same QA bucket',async()=>{
 const {createQaCaseEvidenceRepository}=await import('../src/js/services/qa-case-evidence.js');
 const qaOrigin='https://qfctnnnnltghepwujpdm.supabase.co';
 const correct=qaOrigin+'/storage/v1/object/sign/qa-case-evidence/'+expectedPath+'?token=synthetic';
 const substitutions=[
  correct,
  qaOrigin+'/storage/v1/object/sign/qa-case-evidence/source-2/pqrs/'+caseId+'/'+actor+'/'+id+'.pdf?token=synthetic',
  qaOrigin+'/storage/v1/object/sign/qa-case-evidence/'+expectedPath+'-other?token=synthetic',
  qaOrigin+'/storage/v1/object/public/qa-case-evidence/'+expectedPath+'?token=synthetic',
  'https://attacker.example/storage/v1/object/sign/qa-case-evidence/'+expectedPath+'?token=synthetic'
 ];
 function fakeClient(url){
  return {
   auth:{
    mfa:{getAuthenticatorAssuranceLevel:async()=>({data:{currentLevel:'aal2'},error:null})},
    getUser:async()=>({data:{user:{id:actor}},error:null})
   },
   from(table){
    if(table==='memberships')return {select(){return this},eq(){return this},
      limit(){return {data:[{role:'admin'}],error:null}}};
    if(table==='pilot_pqrs')return {select(){return this},eq(){return this},
      single(){return {data:{id:caseId,project_id:project},error:null}}};
    if(table==='qa_case_evidence')return {select(){return this},eq(){return this},
      order(){return this},limit(){return {data:[valid],error:null}}};
    throw Error('Unexpected private table: '+table);
   },
   storage:{from(bucket){
    assert.equal(bucket,'qa-case-evidence');
    return {createSignedUrl:async(path,ttl)=>{
     assert.equal(path,expectedPath);assert.equal(ttl,90);
     return {data:{signedUrl:url},error:null};
    }};
   }}
  };
 }
 for(let i=0;i<substitutions.length;i++){
  const repo=createQaCaseEvidenceRepository(fakeClient(substitutions[i]));
  if(i===0)assert.equal(await repo.signedEvidence(project,caseId,id),correct);
  else await assert.rejects(repo.signedEvidence(project,caseId,id),/(enlace firmado|Destino de archivo no autorizado)/);
 }
});
test('runtime rejects a tampered evidence listing before exposing its rows',async()=>{
 const {createQaCaseEvidenceRepository}=await import('../src/js/services/qa-case-evidence.js');
 const qaCase='a330278f-54b4-41e6-89a1-805086ec3df4';
 const client={
  auth:{
    mfa:{getAuthenticatorAssuranceLevel:async()=>({data:{currentLevel:'aal2'},error:null})},
    getUser:async()=>({data:{user:{id:actor}},error:null})
  },
  from(table){
   if(table==='memberships')return {select(){return this},eq(){return this},limit(){return {data:[{role:'admin'}],error:null}}};
   if(table==='pilot_pqrs')return {select(){return this},eq(){return this},single(){return {data:{id:qaCase,project_id:project},error:null}}};
   if(table==='qa_case_evidence')return {select(){return this},eq(){return this},order(){return this},
    limit(){return {data:[{...valid,storage_path:expectedPath+'-tampered'}],error:null}}};
   throw Error('Unexpected query');
  }
 };
 const repo=createQaCaseEvidenceRepository(client);
 await assert.rejects(repo.listEvidence(project,caseId),/evidencia no coincide/i);
});
