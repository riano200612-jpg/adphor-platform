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
