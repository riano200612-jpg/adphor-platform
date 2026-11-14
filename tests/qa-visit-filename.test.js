import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {normalizeQaVisitFileName,validateQaVisitEvidence} from '../src/js/services/qa-visit-evidence-policy.js';
import {createVisitFixture,visitUsers as U} from '../qa/visit-lifecycle-fixture.js';

test('private Visit filenames are normalized and never used as paths or HTML',()=>{
 assert.equal(normalizeQaVisitFileName({name:'  Acta de reunión.docx  '}),'Acta de reunión.docx');
 for(const name of ['', ' ', 'directorio/acta.pdf', '..\\informe.pdf', '<img src=x>.pdf',
 '\u0000bad.pdf', 'x'.repeat(181)]){
  assert.throws(()=>normalizeQaVisitFileName({name}),/nombre|Nombre/);
  assert.throws(()=>validateQaVisitEvidence([{name,type:'application/pdf',size:16}]));
 }
 assert.equal(validateQaVisitEvidence([{name:'Acta de inspección.pdf',type:'application/pdf',size:16}]).length,1);
});
let fixture;
before(async()=>{fixture=await createVisitFixture()});
after(async()=>{await fixture?.db.close()});
test('filename is private, immutable, scoped by visit and constrained in PostgreSQL',async()=>{
 const visit=randomUUID(),id=randomUUID(),path=['p1','visitas',visit,U.admin,id+'.pdf'].join('/');
 await fixture.create(visit);
 await fixture.as(U.admin,'aal2','insert into storage.objects(bucket_id,name,owner_id) values($1,$2,$3)',['qa-visit-evidence',path,U.admin]);
 const insert='insert into qa_visit_evidence(id,project_id,request_id,storage_bucket,storage_path,media_type,file_bytes,uploaded_by,file_name) values($1,$2,$3,$4,$5,$6,$7,$8,$9) returning file_name';
 const values=[id,'p1',visit,'qa-visit-evidence',path,'application/pdf',16,U.admin,'Acta de inspección.pdf'];
 for(const name of ['mal/<script>.pdf',' document.pdf ','x'.repeat(181),'<img>.pdf']){
  await assert.rejects(fixture.as(U.admin,'aal2',insert,[...values.slice(0,8),name]),/constraint|violates/i);
 }
 await assert.rejects(fixture.as(U.admin,'aal1',insert,values),/row-level|permission denied/i);
 await assert.rejects(fixture.as(U.viewer,'aal2',insert,values),/row-level|permission denied/i);
 const saved=await fixture.as(U.admin,'aal2',insert,values);
 assert.equal(saved.rows[0].file_name,'Acta de inspección.pdf');
 const visible=await fixture.as(U.admin,'aal2','select file_name from qa_visit_evidence where request_id=$1',[visit]);
 assert.deepEqual(visible.rows.map(x=>x.file_name),['Acta de inspección.pdf']);
 const invisible=await fixture.as(U.other,'aal2','select file_name from qa_visit_evidence where request_id=$1',[visit]);
 assert.equal(invisible.rows.length,0);
 await assert.rejects(fixture.as(U.admin,'aal2',"update qa_visit_evidence set file_name='Alterado.pdf' where request_id=$1",[visit]),/permission denied/i);
});
