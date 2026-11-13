import test from 'node:test';
import assert from 'node:assert/strict';
import {createQaCaseEvidenceRepository,evidenceObjectId} from '../src/js/services/qa-case-evidence.js';

const project='qa-property',caseId='a330278f-54b4-41e6-89a1-805086ec3df4';
const actor='ff29397f-a90b-47ad-97ab-a299dfcbdd66';
const file={name:'privado.pdf',type:'application/pdf',size:7,async arrayBuffer(){return Uint8Array.from([37,80,68,70,45,49,55]).buffer;}};

function fixture({aal='aal2',role='admin',validCase=true,storageFailure=null}={}){
 const stored=[],uploads=[],calls=[];
 const client={
  auth:{
   mfa:{getAuthenticatorAssuranceLevel:async()=>({data:{currentLevel:aal},error:null})},
   getUser:async()=>({data:{user:{id:actor}},error:null})
  },
  from(table){
   calls.push(table);
   if(table==='memberships')return {
    select(){return this},eq(){return this},limit(){return {data:role?[{role}]:[],error:null}}
   };
   if(table==='pilot_pqrs')return {
    select(){return this},eq(){return this},single(){return {
      data:validCase?{id:caseId,project_id:project}:null,
      error:validCase?null:{message:'case not found'}
    }}
   };
   assert.equal(table,'qa_case_evidence');
   const query={
    filters:{},
    select(){return this},
    eq(k,v){this.filters[k]=v;return this},
    order(){return this},
    limit(){const rows=stored.filter(row=>Object.entries(this.filters).every(([k,v])=>row[k]===v));return {data:rows,error:null};},
    insert(row){this.toInsert=row;return this},
    single(){const row=this.toInsert;stored.push({...row,created_at:'2026-11-13T12:00:00Z'});return {data:row,error:null}}
   };
   return query;
  },
  storage:{
   from(bucket){
    assert.equal(bucket,'qa-case-evidence');
    return {
      async upload(path,blob,opts){uploads.push({path,blob,opts});return storageFailure
        ?{data:null,error:storageFailure}:{data:{path},error:null};},
      async createSignedUrl(path,expiry){assert.equal(expiry,90);return {data:{signedUrl:'https://qfctnnnnltghepwujpdm.supabase.co/storage/v1/object/sign/qa-case-evidence/'+path+'?token=synthetic'},error:null};}
    };
   }
  }
 };
 return {repo:createQaCaseEvidenceRepository(client),stored,uploads,calls};
}
test('private file fingerprint stays stable per user, case and file; changes across cases',async()=>{
 const first=await evidenceObjectId(file,project,caseId,actor);
 assert.match(first,/^[a-f0-9-]{36}$/);
 assert.equal(await evidenceObjectId(file,project,caseId,actor),first);
 assert.notEqual(await evidenceObjectId(file,project,'b330278f-54b4-41e6-89a1-805086ec3df4',actor),first);
});
test('the signed-in member uploads once, links metadata, then reloads the same private evidence',async()=>{
 const x=fixture();
 const results=await x.repo.uploadEvidence({projectId:project,caseId,files:[file]});
 assert.equal(results.length,1);
 assert.equal(x.uploads.length,1);
 assert.equal(x.uploads[0].opts.upsert,false);
 assert.equal(x.stored[0].storage_bucket,'qa-case-evidence');
 assert.match(x.stored[0].storage_path,new RegExp('^'+project+'/pqrs/'+caseId+'/'+actor+'/'));
 const again=await x.repo.uploadEvidence({projectId:project,caseId,files:[file]});
 assert.deepEqual(again,results);
 assert.equal(x.uploads.length,1,'retry must not create a duplicate object');
 const entries=await x.repo.listEvidence(project,caseId);
 assert.equal(entries.length,1);
 const url=await x.repo.signedEvidence(project,caseId,results[0].id);
 assert.match(url,/^https:\/\/qfctnnnnltghepwujpdm.supabase.co\/storage\/v1\/object\/sign\/qa-case-evidence\//);
});
test('AAL1, unauthorized member and cross-case access must fail before writing to storage',async()=>{
 for(const config of [{aal:'aal1'},{role:'viewer'},{validCase:false}]){
  const x=fixture(config);
  await assert.rejects(x.repo.uploadEvidence({projectId:project,caseId,files:[file]}));
  assert.equal(x.uploads.length,0);
  assert.equal(x.stored.length,0);
 }
 await assert.rejects(fixture().repo.uploadEvidence({projectId:'../admin',caseId,files:[file]}));
 await assert.rejects(fixture().repo.uploadEvidence({projectId:project,caseId,kind:'visits',files:[file]}));
 await assert.rejects(fixture().repo.uploadEvidence({projectId:project,caseId,files:[{...file,type:'text/html'}]}));
});
test('storage errors never fabricate a linked evidence result',async()=>{
 const x=fixture({storageFailure:{statusCode:'400',message:'access denied'}});
 await assert.rejects(x.repo.uploadEvidence({projectId:project,caseId,files:[file]}),/carga privada/);
 assert.equal(x.stored.length,0);
});
