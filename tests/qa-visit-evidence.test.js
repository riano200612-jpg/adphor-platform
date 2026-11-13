import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createVisitFixture,visitUsers as U} from '../qa/visit-lifecycle-fixture.js';
import {createQaVisitEvidenceRepository} from '../src/js/services/qa-visit-evidence.js';
const projectId='p1',actor=U.admin;
const file={name:'evidencia.pdf',type:'application/pdf',size:7,async arrayBuffer(){return Uint8Array.from([37,80,68,70,45,49,55]).buffer;}};
let f;
before(async()=>{f=await createVisitFixture();});
after(async()=>{await f?.db.close();});
const path=(visit,id,user=actor)=>[projectId,'visitas',visit,user,id+'.pdf'].join('/');
async function insertObject({visit,id,user=actor,aal='aal2',project=projectId,filename}={}){
 const location=filename??path(visit,id,user);
 return f.as(user,aal,'insert into storage.objects(bucket_id,name,owner_id) values($1,$2,$3)',[
  'qa-visit-evidence',location,user
 ]);
}
async function insertMetadata({visit,id,user=actor,aal='aal2',created_at,storagePath}={}){
 const columns='id,project_id,request_id,storage_bucket,storage_path,media_type,file_bytes,uploaded_by';
 const values=[id,projectId,visit,'qa-visit-evidence',storagePath??path(visit,id,user),'application/pdf',7,user];
 if(created_at){return f.as(user,aal,`insert into qa_visit_evidence(${columns},created_at) values($1,$2,$3,$4,$5,$6,$7,$8,$9)`,[...values,created_at]);}
 return f.as(user,aal,`insert into qa_visit_evidence(${columns}) values($1,$2,$3,$4,$5,$6,$7,$8) returning *`,values);
}
test('Visitas private bucket, FK, user-owned object and immutable history are required in isolated SQL',async()=>{
 const visit=randomUUID(),fileId=randomUUID();
 await f.create(visit);
 const bucket=await f.db.query("select id,public,file_size_limit from storage.buckets where id='qa-visit-evidence'");
 assert.equal(bucket.rows.length,1);assert.equal(bucket.rows[0].public,false);
 await assert.rejects(insertMetadata({visit,id:fileId}),/row-level security|violates row-level|permission denied/i);
 await insertObject({visit,id:fileId});
 const metadata=(await insertMetadata({visit,id:fileId})).rows[0];
 assert.equal(metadata.project_id,'p1');
 assert.equal(metadata.request_id,visit);
 assert.equal(metadata.uploaded_by,actor);
 assert.ok(metadata.created_at);
 const records=await f.as(actor,'aal2','select * from qa_visit_evidence where request_id=$1',[visit]);
 assert.equal(records.rows.length,1);
 for(const q of [
  'delete from qa_visit_evidence',
  "update qa_visit_evidence set file_bytes=8",
  'update storage.objects set bucket_id=\'evidence\''
 ])await assert.rejects(f.as(actor,'aal2',q),/permission denied|row-level/i);
});
test('Private Storage and metadata reject AAL1, viewer, inactive and foreign-property attempts',async()=>{
 const visit=randomUUID();await f.create(visit);
 for(const [user,aal] of [[actor,'aal1'],[U.viewer,'aal2'],[U.other,'aal2'],[U.inactive,'aal2'],[null,'aal2']]){
  const id=randomUUID(),pathValue=path(visit,id,user||actor);
  await assert.rejects(f.as(user,aal,'insert into storage.objects(bucket_id,name,owner_id) values($1,$2,$3)',[
   'qa-visit-evidence',pathValue,user
  ]),/row-level|permission denied/i);
 }
 const id=randomUUID();
 await assert.rejects(insertObject({visit,id,filename:`p2/visitas/${visit}/${actor}/${id}.pdf`}),/row-level|permission denied/i);
 const otherVisit=randomUUID();await f.create(otherVisit);
 await insertObject({visit:otherVisit,id});
 await assert.rejects(insertMetadata({visit,id,storagePath:path(otherVisit,id)}),/check constraint|row-level/i);
 await assert.rejects(insertMetadata({visit:otherVisit,id,created_at:'2000-01-01T00:00:00Z'}),/permission denied/i);
});
test('finalised or cancelled Visits reject new storage objects and metadata but preserve prior private evidence',async()=>{
 const completed=randomUUID(),prior=randomUUID(),late=randomUUID(),after=randomUUID();
 await f.create(completed);
 await insertObject({visit:completed,id:prior});
 await insertMetadata({visit:completed,id:prior});
 // An unlinked Storage object created before closure cannot be linked afterwards.
 await insertObject({visit:completed,id:late});
 await f.transition({requestId:completed,operationId:randomUUID(),version:1,action:'start'});
 await f.transition({requestId:completed,operationId:randomUUID(),version:2,action:'finish',
  values:{observations:'Verificada',activities:'Inspección',conclusions:'Finalizada',commitments:''}});
 await assert.rejects(insertObject({visit:completed,id:after}),/row-level|permission denied/i);
 await assert.rejects(insertMetadata({visit:completed,id:late}),/row-level|permission denied/i);
 const earlier=await f.as(actor,'aal2','select id from qa_visit_evidence where request_id=$1',[completed]);
 assert.deepEqual(earlier.rows.map(row=>row.id),[prior],'prior evidence remains readable');
 const cancelled=randomUUID();await f.create(cancelled);
 await f.transition({requestId:cancelled,operationId:randomUUID(),version:1,action:'cancel',values:{reason:'Sin acceso'}});
 await assert.rejects(insertObject({visit:cancelled,id:randomUUID()}),/row-level|permission denied/i);
});
test('client refuses upload to a closed Visit without touching private Storage',async()=>{
 for(const status of ['completada','cancelada']){
  const requestId=randomUUID();let uploaded=false;
  const user=actor;
  const client={
   auth:{mfa:{getAuthenticatorAssuranceLevel:async()=>({data:{currentLevel:'aal2'},error:null})},
     getUser:async()=>({data:{user:{id:user}},error:null})},
   from(table){
    if(table==='memberships')return {select(){return this},eq(){return this},limit(){return {data:[{role:'admin'}],error:null}}};
    if(table==='qa_visits')return {select(){return this},eq(){return this},single(){return {data:{project_id:projectId,request_id:requestId,status},error:null}}};
    throw Error('Closed Visit must not read evidence table: '+table);
   },
   storage:{from(){uploaded=true;throw Error('Storage reached for closed Visit');}}
  };
  const repository=createQaVisitEvidenceRepository(client);
  await assert.rejects(repository.uploadEvidence({projectId,requestId,files:[file]}),/cerrada/);
  assert.equal(uploaded,false);
 }
});
test('Private evidence UI repository scopes retries and signed read without service credentials',async()=>{
 const visit=randomUUID(),saved=[],uploads=[];
 const client={
  auth:{mfa:{getAuthenticatorAssuranceLevel:async()=>({data:{currentLevel:'aal2'},error:null})},
    getUser:async()=>({data:{user:{id:actor}},error:null})},
  from(table){
   if(table==='memberships')return {select(){return this},eq(){return this},limit(){return {data:[{role:'admin'}],error:null}}};
   if(table==='qa_visits')return {select(){return this},eq(){return this},single(){return {data:{project_id:projectId,request_id:visit,status:'programada'},error:null}}};
   assert.equal(table,'qa_visit_evidence');
   const q={criteria:{},select(){return this},eq(k,v){this.criteria[k]=v;return this},order(){return this},
    limit(){return {data:saved.filter(x=>Object.entries(this.criteria).every(([key,value])=>x[key]===value)),error:null}},
    insert(row){this.current=row;return this},
    single(){saved.push({...this.current,created_at:'2026-11-13T12:00:00Z'});return {data:this.current,error:null}}};
   return q;
  },
  storage:{from(bucket){assert.equal(bucket,'qa-visit-evidence');return {
   upload:async(location,blob,opts)=>{uploads.push({location,opts});return {data:{path:location},error:null}},
   createSignedUrl:async(location,ttl)=>{assert.equal(ttl,90);return {data:{signedUrl:'https://qfctnnnnltghepwujpdm.supabase.co/storage/v1/object/sign/qa-visit-evidence/'+location+'?token=synthetic'},error:null}}
  }}}
 };
 const e=createQaVisitEvidenceRepository(client);
 const first=await e.uploadEvidence({projectId,requestId:visit,files:[file]});
 assert.equal(first.length,1);assert.equal(saved.length,1);assert.equal(uploads.length,1);
 assert.equal(uploads[0].opts.upsert,false);
 await e.uploadEvidence({projectId,requestId:visit,files:[file]});
 assert.equal(uploads.length,1,'retry must reuse metadata and object');
 assert.equal((await e.listEvidence(projectId,visit)).length,1);
 assert.match(await e.signedEvidence(projectId,visit,first[0].id),/^https:\/\/qfctnnnnltghepwujpdm.supabase.co\/storage\/v1\/object\/sign\/qa-visit-evidence\//);
 await assert.rejects(e.uploadEvidence({projectId:'p2',requestId:visit,files:[{...file,type:'text/html'}]}));
 await assert.rejects(e.signedEvidence(projectId,visit,randomUUID()),/no encontrada/i);
});
