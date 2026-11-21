import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createQaMissDocumentIntake} from '../src/js/services/qa-miss-drive-intake.js';

const actor='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const tenant='source-1';
const bytes=Buffer.from('%PDF-1.7\nqa isolated example\n');
const sha=createHash('sha256').update(bytes).digest('hex');
const expectedPath=tenant+'/'+actor+'/'+sha+'.pdf';
const file={name:'Acta QA.pdf',type:'application/pdf',size:bytes.length,
 arrayBuffer:async()=>Uint8Array.from(bytes).buffer};
function mock({error=null,prior=null,incorrectPath=false}={}) {
 const calls={uploads:0,inserts:0,queries:0};
 const complete={id:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',project_id:tenant,
  uploaded_by:actor,review_state:'quarantined',source_kind:'upload',
  object_path:expectedPath,sha256:sha,media_type:'application/pdf',file_bytes:bytes.length};
 const from=name=> {
  if(name==='memberships')return {
   select(){return this},eq(){return this},
   limit:async()=>({data:[{role:'viewer'}]})
  };
  if(name!=='qa_miss_document_submissions')throw Error('unexpected table '+name);
  const query={
   select(fields){assert.match(fields,/object_path,media_type,file_bytes,sha256/);return this},
   eq(){return this},
   limit:async()=>{calls.queries++;return {data:prior?[prior]:[]}},
   insert(rec){calls.inserts++;return {select(){return {single:async()=>({data:{...complete,...rec},error:null})}}}}
  };
  return query;
 };
 const client={
  auth:{mfa:{getAuthenticatorAssuranceLevel:async()=>({data:{currentLevel:'aal2'}})},
   getUser:async()=>({data:{user:{id:actor}}})},
  from,
  storage:{from(bucket){assert.equal(bucket,'qa-miss-documents');return {
   upload:async(path,uploaded,opts)=>{
    calls.uploads++;assert.equal(path,expectedPath);
    assert.equal(uploaded,file);assert.equal(opts.upsert,false);
    return error?{error}:{data:{path:incorrectPath?'wrong-path':path},error:null};
   }
  }}}
 };
 return {client,calls,complete};
}
test('Miss intake records full hash, storage path and bytes only after safe upload',async()=>{
 const m=mock();
 const row=await createQaMissDocumentIntake(m.client).addLocalFile(tenant,file);
 assert.equal(row.object_path,expectedPath);
 assert.equal(row.sha256,sha);
 assert.equal(m.calls.uploads,1);
 assert.equal(m.calls.inserts,1);
});
test('Miss retry accepts a 400 ResourceAlreadyExists only with identical scoped record',async()=>{
 const m=mock({error:{code:'ResourceAlreadyExists',statusCode:'400',message:'Asset already exists'},
  prior:{...mock().complete}});
 const row=await createQaMissDocumentIntake(m.client).addLocalFile(tenant,file);
 assert.equal(row.sha256,sha);
 assert.equal(m.calls.inserts,0);
 assert.equal(m.calls.queries,1);
});
test('Miss retry rejects orphan object and an ordinary Storage 400',async()=>{
 const orphan=mock({error:{code:'ResourceAlreadyExists',statusCode:'409',message:'Asset already exists'}});
 await assert.rejects(createQaMissDocumentIntake(orphan.client).addLocalFile(tenant,file),/Solicita revisión/);
 assert.equal(orphan.calls.inserts,0);
 const invalid=mock({error:{code:'InvalidMimeType',statusCode:'400',message:'Invalid MIME'}});
 await assert.rejects(createQaMissDocumentIntake(invalid.client).addLocalFile(tenant,file),/No se confirmó el almacenamiento/);
 assert.equal(invalid.calls.queries,0);
 assert.equal(invalid.calls.inserts,0);
});
test('Miss refuses an altered upload result and a forged PDF signature',async()=>{
 const mismatch=mock({incorrectPath:true});
 await assert.rejects(createQaMissDocumentIntake(mismatch.client).addLocalFile(tenant,file),/ruta de Storage/);
 assert.equal(mismatch.calls.inserts,0);
 const exe=Buffer.from('MZ-malicious pretend PDF');
 const forgedFile={name:'Falso.pdf',type:'application/pdf',size:exe.length,
  arrayBuffer:async()=>Uint8Array.from(exe).buffer};
 const m=mock();
 await assert.rejects(createQaMissDocumentIntake(m.client).addLocalFile(tenant,forgedFile),/encabezado/);
 assert.equal(m.calls.uploads,0);
});

test('la bandeja sigue disponible después de 51 aportes propios',async()=>{
 const {client,complete}=mock();
 const original=client.from;
 const rows=Array.from({length:51},(_,i)=>({...complete,id:String(i)}));
 client.from=table=>table==='memberships'?original(table):{
  select(){return this},eq(){return this},order(){return this},
  limit:async count=>({data:rows.slice(0,count)})
 };
 const result=await createQaMissDocumentIntake(client).listOwn(tenant);
 assert.deepEqual(result,rows.slice(0,50));
});
