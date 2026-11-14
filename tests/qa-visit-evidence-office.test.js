import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {validateQaVisitEvidence,QA_VISIT_OFFICE_EXT} from '../src/js/services/qa-visit-evidence-policy.js';
import {validateQaEvidence} from '../src/js/services/qa-evidence-policy.js';
import {officeEvidenceObjectId} from '../src/js/services/qa-visit-evidence.js';
const doc='application/vnd.openxmlformats-officedocument.wordprocessingml.document',sheet='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
test('Office OpenXML accepted only for Visits, with exact extension and MIME',()=>{
 for(const [type,ext] of Object.entries(QA_VISIT_OFFICE_EXT)){
  assert.equal(validateQaVisitEvidence([{name:'acta.'+ext,type,size:25}]).length,1);
  assert.equal(validateQaVisitEvidence([{name:'ACTA.'+ext.toUpperCase(),type,size:25}]).length,1);
  assert.throws(()=>validateQaEvidence([{name:'acta.'+ext,type,size:25}]));
  assert.throws(()=>validateQaVisitEvidence([{name:'acta.'+(ext==='docx'?'xlsx':'docx'),type,size:25}]),/extensión/);
 }
 for(const type of ['application/msword','application/vnd.ms-excel','application/vnd.ms-word.document.macroEnabled.12','text/html'])
  assert.throws(()=>validateQaVisitEvidence([{name:'acta.docx',type,size:25}]),/Archivo no permitido/);
 assert.throws(()=>validateQaVisitEvidence([{name:'acta.docx.exe',type:doc,size:25}]),/extensión/);
 assert.throws(()=>validateQaVisitEvidence([{name:'acta.docx',type:doc,size:0}]));
 assert.throws(()=>validateQaVisitEvidence([{name:'acta.docx',type:doc,size:20971521}]));
 assert.throws(()=>validateQaVisitEvidence(Array.from({length:6},()=>({name:'a.xlsx',type:sheet,size:12}))));
});
test('Office uploads get stable scoped IDs and reject a non-ZIP header',async()=>{
 const request=randomUUID(),actor=randomUUID();
 const content=Uint8Array.from([0x50,0x4b,0x03,0x04,1,2,3,4]);
 const file={name:'acta.docx',type:doc,size:content.length,async arrayBuffer(){return content.buffer;}};
 const id=await officeEvidenceObjectId(file,'p1',request,actor);
 assert.match(id,/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
 assert.equal(id,await officeEvidenceObjectId(file,'p1',request,actor));
 assert.notEqual(id,await officeEvidenceObjectId(file,'p2',request,actor));
 await assert.rejects(officeEvidenceObjectId({...file,async arrayBuffer(){return Uint8Array.from([0,0,0,0,1,2,3,4]).buffer;}},'p1',request,actor),/cabecera ZIP/);
});
