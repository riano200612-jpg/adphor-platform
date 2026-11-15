import {test} from 'node:test';
import assert from 'node:assert/strict';
import {File} from 'node:buffer';
import {canPrepareSyntheticVisitPdf,canPrepareSyntheticVisitFollowUp,QA_SYNTHETIC_VISIT_FOLLOWUP,createSyntheticVisitPdfFile,syntheticVisitPdfBytes,QA_SYNTHETIC_VISIT_PDF_NAME} from '../src/js/services/qa-visit-synthetic-pdf.js';
import {visitTransitionPayload} from '../src/js/services/visit-lifecycle.js';
import {validateQaVisitEvidence} from '../src/js/services/qa-visit-evidence-policy.js';
const origin='qa-integral-claude-reviewed.adphor-platform.pages.dev';
const row={project_id:'source-1',request_id:'ea01dd3c-9fc8-4ac4-9d2a-6c6c345993c7',
 motive:'[QA E2E 2026-11-15] Verificación técnica controlada — SIN VISITA REAL',
 status:'programada'};
test('Synthetic Visit evidence control appears only for write-authorized active QA fixtures',()=>{
 assert.equal(canPrepareSyntheticVisitPdf({hostname:origin,row,canWrite:true}),true);
 assert.equal(canPrepareSyntheticVisitPdf({hostname:origin,row:{...row,status:'en_ejecucion'},canWrite:true}),true);
 for(const hostname of ['localhost','app.adphor.com','qa-other.adphor-platform.pages.dev','']){
  assert.equal(canPrepareSyntheticVisitPdf({hostname,row,canWrite:true}),false);
 }
 for(const status of ['completada','cancelada','desconocida']){
  assert.equal(canPrepareSyntheticVisitPdf({hostname:origin,row:{...row,status},canWrite:true}),false);
 }
 assert.equal(canPrepareSyntheticVisitPdf({hostname:origin,row,canWrite:false}),false);
 assert.equal(canPrepareSyntheticVisitPdf({hostname:origin,row:{...row,motive:'Visita real'},canWrite:true}),false);
 assert.equal(canPrepareSyntheticVisitPdf({hostname:origin,row:{...row,motive:'[QA E2E 2026-11-15] Operativa real'},canWrite:true}),false);
});
test('Original PDF has valid object offsets and contains no personal or original documents',async()=>{
 const bytes=syntheticVisitPdfBytes();
 const doc=new TextDecoder().decode(bytes);
 assert.ok(bytes.length>300&&bytes.length<4096);
 assert.ok(doc.startsWith('%PDF-1.4\n'));
 assert.match(doc,/ADPHOR QA - ARCHIVO SINTETICO - NO REAL/);
 assert.match(doc,/\/Type \/Catalog/);
 const xrefIndex=Number(doc.match(/startxref\n(\d+)\n%%EOF/)?.[1]);
 assert.equal(doc.slice(xrefIndex,xrefIndex+5),'xref\n');
 const offsets=[...doc.matchAll(/^(\d{10}) 00000 n $/gm)].map(m=>Number(m[1]));
 assert.equal(offsets.length,5);
 for(let i=0;i<5;i++)assert.equal(doc.slice(offsets[i],offsets[i]+8),(i+1)+' 0 obj\n');
 const f=createSyntheticVisitPdfFile(File);
 assert.equal(f.name,QA_SYNTHETIC_VISIT_PDF_NAME);
 assert.equal(f.type,'application/pdf');
 assert.equal(f.size,bytes.length);
 assert.deepEqual(validateQaVisitEvidence([f]),[f]);
 assert.deepEqual(new Uint8Array(await f.arrayBuffer()),bytes);
});

test('Only active, explicitly synthetic QA visits can populate follow-up fields',()=>{
 const hostname='qa-integral-claude-reviewed.adphor-platform.pages.dev';
 assert.equal(canPrepareSyntheticVisitFollowUp({hostname,row:{...row,status:'en_ejecucion'},canWrite:true}),true);
 for(const status of ['programada','completada','cancelada']){
  assert.equal(canPrepareSyntheticVisitFollowUp({hostname,row:{...row,status},canWrite:true}),false);
 }
 assert.equal(canPrepareSyntheticVisitFollowUp({hostname:'localhost',row:{...row,status:'en_ejecucion'},canWrite:true}),false);
 assert.equal(canPrepareSyntheticVisitFollowUp({hostname,row:{...row,status:'en_ejecucion',motive:'Visita real'},canWrite:true}),false);
 assert.equal(canPrepareSyntheticVisitFollowUp({hostname,row:{...row,status:'en_ejecucion'},canWrite:false}),false);
 const payload=visitTransitionPayload('finish',QA_SYNTHETIC_VISIT_FOLLOWUP);
 for(const key of ['observations','activities','conclusions','commitments']){
  assert.equal(typeof payload[key],'string');
  assert.equal(payload[key],QA_SYNTHETIC_VISIT_FOLLOWUP[key]);
  assert.ok(payload[key].includes('QA')||payload[key].includes('reales'));
 }
 assert.match(payload.conclusions,/sin visita física/);
 assert.equal(Object.isFrozen(QA_SYNTHETIC_VISIT_FOLLOWUP),true);
});
