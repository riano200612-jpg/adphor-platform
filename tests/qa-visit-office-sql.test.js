import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createVisitFixture,visitUsers as U} from '../qa/visit-lifecycle-fixture.js';
const office=[['application/vnd.openxmlformats-officedocument.wordprocessingml.document','docx'],['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','xlsx']];
let f;
before(async()=>{f=await createVisitFixture()});
after(async()=>{await f?.db.close()});
test('Office metadata and private bucket enforce MFA and exact paths on synthetic SQL',async()=>{
 const bucket=(await f.db.query("select public,file_size_limit,allowed_mime_types from storage.buckets where id='qa-visit-evidence'")).rows[0];
 assert.equal(bucket.public,false);assert.equal(Number(bucket.file_size_limit),20971520);
 for(const [mime,ext] of office){
  assert.ok(bucket.allowed_mime_types.includes(mime));
  const visit=randomUUID(),id=randomUUID();await f.create(visit);
  const location=['p1','visitas',visit,U.admin,id+'.'+ext].join('/');
  const stmt='insert into storage.objects(bucket_id,name,owner_id) values($1,$2,$3)';
  await assert.rejects(f.as(U.admin,'aal1',stmt,['qa-visit-evidence',location,U.admin]),/row-level|permission denied/i);
  await assert.rejects(f.as(U.other,'aal2',stmt,['qa-visit-evidence',location,U.other]),/row-level|permission denied/i);
  await f.as(U.admin,'aal2',stmt,['qa-visit-evidence',location,U.admin]);
  const meta='insert into qa_visit_evidence(id,project_id,request_id,storage_bucket,storage_path,media_type,file_bytes,uploaded_by) values($1,$2,$3,$4,$5,$6,$7,$8) returning id';
  const args=[id,'p1',visit,'qa-visit-evidence',location,mime,10,U.admin];
  await assert.rejects(f.as(U.admin,'aal2',meta,[...args.slice(0,5),'text/html',...args.slice(6)]),/check constraint|violates/i);
  const saved=await f.as(U.admin,'aal2',meta,args);
  assert.equal(saved.rows[0].id,id);
  const found=await f.as(U.admin,'aal2','select id from qa_visit_evidence where request_id=$1',[visit]);
  assert.equal(found.rows.length,1);
 }
});
