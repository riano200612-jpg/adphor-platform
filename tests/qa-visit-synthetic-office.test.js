import {test} from 'node:test';
import assert from 'node:assert/strict';
import {File} from 'node:buffer';
import {syntheticVisitOfficeBytes,createSyntheticVisitOfficeFile,SYNTHETIC_VISIT_OFFICE,canPrepareSyntheticVisitOffice} from '../src/js/services/qa-visit-synthetic-office.js';
import {validateQaVisitEvidence} from '../src/js/services/qa-visit-evidence-policy.js';

const row={status:'programada',motive:'[QA E2E 2026-11-17] Archivo sintético — SIN VISITA REAL'};
const u16=(bytes,at)=>new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength).getUint16(at,true);
const u32=(bytes,at)=>new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength).getUint32(at,true);
const decode=bytes=>new TextDecoder().decode(bytes);
function crc(bytes){
 let c=0xffffffff;for(const b of bytes){c^=b;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}
 return (c^0xffffffff)>>>0;
}
function verifyZip(bytes){
 const end=bytes.length-22;
 assert.equal(u32(bytes,end),0x06054b50,'End of central directory');
 const total=u16(bytes,end+10),centralSize=u32(bytes,end+12),centralStart=u32(bytes,end+16);
 assert.equal(u16(bytes,end+8),total);
 assert.equal(centralStart+centralSize,end);
 assert.ok(total>=3&&total<=5);
 const names=[],content={};let p=centralStart;
 for(let i=0;i<total;i++){
  assert.equal(u32(bytes,p),0x02014b50);
  assert.equal(u16(bytes,p+10),0,'No compression');
  const sum=u32(bytes,p+16),size=u32(bytes,p+20),original=u32(bytes,p+24);
  assert.equal(size,original);
  const nameLen=u16(bytes,p+28),extra=u16(bytes,p+30),comment=u16(bytes,p+32);
  const local=u32(bytes,p+42),name=decode(bytes.slice(p+46,p+46+nameLen));
  assert.equal(u32(bytes,local),0x04034b50);
  assert.equal(u16(bytes,local+8),0,'Stored XML');
  assert.equal(u32(bytes,local+14),sum);
  const localNameLen=u16(bytes,local+26),localExtra=u16(bytes,local+28);
  assert.equal(decode(bytes.slice(local+30,local+30+localNameLen)),name);
  const data=bytes.slice(local+30+localNameLen+localExtra,local+30+localNameLen+localExtra+size);
  assert.equal(crc(data),sum,'CRC32 must match OOXML part');
  assert.ok(!name.startsWith('/')&&!name.includes('..'));
  assert.ok(!names.includes(name));
  names.push(name);content[name]=decode(data);
  p+=46+nameLen+extra+comment;
 }
 assert.equal(p,end);
 return {names,content};
}
test('Synthetic Office controls are limited to authorized active, explicitly marked QA Visits',()=>{
 assert.equal(canPrepareSyntheticVisitOffice({hostname:'qa-integral-claude-reviewed.adphor-platform.pages.dev',row,canWrite:true}),true);
 for(const hostname of ['localhost','example.com','qa-other.adphor-platform.pages.dev']){
  assert.equal(canPrepareSyntheticVisitOffice({hostname,row,canWrite:true}),false);
 }
 for(const status of ['cancelada','completada']){
  assert.equal(canPrepareSyntheticVisitOffice({hostname:'qa-integral-claude-reviewed.adphor-platform.pages.dev',row:{...row,status},canWrite:true}),false);
 }
 assert.equal(canPrepareSyntheticVisitOffice({hostname:'qa-integral-claude-reviewed.adphor-platform.pages.dev',row,canWrite:false}),false);
 assert.equal(canPrepareSyntheticVisitOffice({hostname:'qa-integral-claude-reviewed.adphor-platform.pages.dev',row:{...row,motive:'Visita real'},canWrite:true}),false);
});
test('DOCX/XLSX are valid, original OOXML ZIP fixtures with CRC and canonical package parts',async()=>{
 for(const kind of ['docx','xlsx']){
  const fixture=createSyntheticVisitOfficeFile(kind,File);
  assert.equal(fixture.name,SYNTHETIC_VISIT_OFFICE[kind].name);
  assert.equal(fixture.type,SYNTHETIC_VISIT_OFFICE[kind].type);
  assert.ok(fixture.size>500&&fixture.size<8192);
  assert.deepEqual(validateQaVisitEvidence([fixture]),[fixture]);
  const b=syntheticVisitOfficeBytes(kind);
  assert.deepEqual(b,new Uint8Array(await fixture.arrayBuffer()));
  const {names,content}=verifyZip(b);
  assert.ok(names.includes('[Content_Types].xml')&&names.includes('_rels/.rels'));
  assert.match(content['_rels/.rels'],/relationships\/officeDocument/);
  if(kind==='docx'){
   assert.ok(names.includes('word/document.xml'));
   assert.match(content['word/document.xml'],/<w:document/);
   assert.match(content['word/document.xml'],/DOCUMENTO SINTETICO - NO REAL/);
  }else{
   for(const n of ['xl/workbook.xml','xl/worksheets/sheet1.xml','xl/_rels/workbook.xml.rels'])assert.ok(names.includes(n));
   assert.match(content['xl/worksheets/sheet1.xml'],/DOCUMENTO SINTETICO - NO REAL/);
   assert.match(content['xl/workbook.xml'],/PRUEBA QA NO REAL/);
  }
 }
 assert.throws(()=>syntheticVisitOfficeBytes('xls'),/no autorizado/);
 assert.throws(()=>createSyntheticVisitOfficeFile('xls',File),/no puede crear/);
});
