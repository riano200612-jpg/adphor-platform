import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 driveSourceFromUrl,missDocumentName,validateMissDocumentFile,
 createQaMissDocumentIntake,MISS_DOCUMENT_BUCKET
} from '../src/js/services/qa-miss-drive-intake.js';
const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const driveId='1RTkvbz6YZftW4Ua_3XHs4PVEPX1kyotG';
test('Drive links allow exact Google file and Docs URLs only',()=>{
 assert.deepEqual(driveSourceFromUrl('https://drive.google.com/file/d/'+driveId+'/view?usp=sharing'),{
  fileId:driveId,kind:'file',url:'https://drive.google.com/file/d/'+driveId+'/view'});
 assert.equal(driveSourceFromUrl('https://docs.google.com/document/d/'+driveId+'/edit').kind,'document');
 for(const bad of ['https://evil.com/file/d/'+driveId+'/view',
  'http://drive.google.com/file/d/'+driveId+'/view',
  'https://drive.google.com/drive/folders/'+driveId,
  'https://drive.google.com.evil.net/file/d/'+driveId+'/view',
  'https://drive.google.com/file/d/'+driveId+'/view#token',
  'https://drive.google.com/file/d/short/view',
  'https://docs.google.com/document/u/0/d/'+driveId+'/edit',
  'https://drive.google.com/file/d/'+driveId+'/view/more']){
  assert.throws(()=>driveSourceFromUrl(bad));
 }
});
test('files and displayed names are bounded before any network write',()=>{
 assert.equal(missDocumentName(' Acta de consejo '),'Acta de consejo');
 for(const bad of ['ab','../file.pdf','evil\\file.pdf','<img>', 'a'.repeat(181)])assert.throws(()=>missDocumentName(bad));
 assert.equal(validateMissDocumentFile({name:'acta.pdf',size:20,type:'application/pdf',arrayBuffer(){}}).extension,'pdf');
 assert.throws(()=>validateMissDocumentFile({name:'acta.exe',size:20,type:'application/pdf',arrayBuffer(){}}));
 assert.throws(()=>validateMissDocumentFile({name:'acta.pdf',size:20*1024*1024,type:'application/pdf',arrayBuffer(){}}));
});
test('unauthorized, AAL1 and cross-property upload attempts fail closed',async()=>{
 let writes=0;
 const chain={select(){return this},eq(){return this},limit(){return Promise.resolve({data:[]})}};
 const client={
  auth:{mfa:{getAuthenticatorAssuranceLevel:async()=>({data:{currentLevel:'aal1'}})},getUser:async()=>({data:{user:{id}}})},
  from(){writes++;return chain},
  storage:{from(){writes++;throw Error('Storage must not be called');}}
 };
 const service=createQaMissDocumentIntake(client);
 await assert.rejects(service.addDriveLink('source-1','https://drive.google.com/file/d/'+driveId+'/view','Acta 2026'),/MFA AAL2/);
 assert.equal(writes,0);
 client.auth.mfa.getAuthenticatorAssuranceLevel=async()=>({data:{currentLevel:'aal2'}});
 await assert.rejects(service.addDriveLink('source-2','https://drive.google.com/file/d/'+driveId+'/view','Acta 2026'),/copropiedad/);
 assert.equal(writes,1);
 assert.throws(()=>createQaMissDocumentIntake(client,{url:'https://production.example'}));
});
test('staging migration forces tenant scope and quarantine; no agent activation',()=>{
 const sql=readFileSync(new URL('../supabase/migrations/20261120221708_qa_miss_document_intake_quarantine.sql',import.meta.url),'utf8');
 assert.match(sql,/ENABLE ROW LEVEL SECURITY/);
 assert.match(sql,/review_state='quarantined'/);
 assert.match(sql,/m\.user_id=\(SELECT auth\.uid\(\)\)/);
 assert.match(sql,/AS RESTRICTIVE[\s\S]*FOR SELECT TO public USING \(bucket_id<>'qa-miss-documents'\)/);
 assert.match(sql,/file_size_limit/);
 assert.match(sql,/CHECK \(review_state = 'quarantined'\)/);
 assert.match(sql,/current_principal\(\)/);
 assert.doesNotMatch(sql,/\b(?:auto_?train|create\s+publication|create\s+trigger)\b/i);
 assert.equal(MISS_DOCUMENT_BUCKET,'qa-miss-documents');
});
