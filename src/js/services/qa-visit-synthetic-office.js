import {canPrepareSyntheticVisitPdf} from './qa-visit-synthetic-pdf.js';

// These fixtures are original, valid small OOXML documents, not renamed PDFs.
// No real customer data, external resources, macros, or uploaded templates.
export const SYNTHETIC_VISIT_OFFICE=Object.freeze({
 docx:Object.freeze({
  name:'ADPHOR-QA-SINTETICO-NO-REAL.docx',
  type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
 }),
 xlsx:Object.freeze({
  name:'ADPHOR-QA-SINTETICO-NO-REAL.xlsx',
  type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
 })
});
export const canPrepareSyntheticVisitOffice=canPrepareSyntheticVisitPdf;
const encode=value=>new TextEncoder().encode(value);
function append(...parts){
 const length=parts.reduce((n,p)=>n+p.length,0),out=new Uint8Array(length);
 let offset=0;for(const p of parts){out.set(p,offset);offset+=p.length;}
 return out;
}
function crc32(bytes){
 let c=0xffffffff;
 for(const b of bytes){
  c^=b;
  for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);
 }
 return (c^0xffffffff)>>>0;
}
function record(size){const b=new Uint8Array(size);return {b,view:new DataView(b.buffer)};}
function packageZip(entries){
 if(entries.length<3||entries.length>10)throw Error('Paquete OOXML inválido.');
 const body=[],central=[];let offset=0,centralSize=0;
 for(const [path,value] of entries){
  if(!/^[A-Za-z0-9_./\[\]-]+$/.test(path)||path.includes('..'))throw Error('Ruta OOXML inválida.');
  const name=encode(path),content=encode(value),sum=crc32(content);
  const local=record(30);
  local.view.setUint32(0,0x04034b50,true);
  local.view.setUint16(4,20,true);
  local.view.setUint16(8,0,true); // Store, not deflate
  local.view.setUint32(14,sum,true);
  local.view.setUint32(18,content.length,true);
  local.view.setUint32(22,content.length,true);
  local.view.setUint16(26,name.length,true);
  const entry=append(local.b,name,content);
  body.push(entry);
  const centralEntry=record(46);
  centralEntry.view.setUint32(0,0x02014b50,true);
  centralEntry.view.setUint16(4,20,true);
  centralEntry.view.setUint16(6,20,true);
  centralEntry.view.setUint32(16,sum,true);
  centralEntry.view.setUint32(20,content.length,true);
  centralEntry.view.setUint32(24,content.length,true);
  centralEntry.view.setUint16(28,name.length,true);
  centralEntry.view.setUint32(42,offset,true);
  central.push(append(centralEntry.b,name));
  centralSize+=46+name.length;
  offset+=entry.length;
 }
 const end=record(22);
 end.view.setUint32(0,0x06054b50,true);
 end.view.setUint16(8,entries.length,true);
 end.view.setUint16(10,entries.length,true);
 end.view.setUint32(12,centralSize,true);
 end.view.setUint32(16,offset,true);
 return append(...body,...central,end.b);
}
const contentTypes=(overrides)=>'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
 +'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
 +'<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
 +'<Default Extension="xml" ContentType="application/xml"/>'
 +overrides+'</Types>';
const packageRels=(type,target)=>'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
 +'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
 +'<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/'+type+'" Target="'+target+'"/>'
 +'</Relationships>';
function parts(kind){
 if(kind==='docx')return [
  ['[Content_Types].xml',contentTypes('<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>')],
  ['_rels/.rels',packageRels('officeDocument','word/document.xml')],
  ['word/document.xml','<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
   +'<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
   +'<w:body><w:p><w:r><w:t>ADPHOR QA - DOCUMENTO SINTETICO - NO REAL</w:t></w:r></w:p>'
   +'<w:sectPr/></w:body></w:document>']
 ];
 if(kind==='xlsx')return [
  ['[Content_Types].xml',contentTypes('<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>')],
  ['_rels/.rels',packageRels('officeDocument','xl/workbook.xml')],
  ['xl/workbook.xml','<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
   +'<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"'
   +' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
   +'<sheets><sheet name="PRUEBA QA NO REAL" sheetId="1" r:id="rId1"/></sheets></workbook>'],
  ['xl/_rels/workbook.xml.rels',packageRels('worksheet','worksheets/sheet1.xml')],
  ['xl/worksheets/sheet1.xml','<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
   +'<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
   +'<sheetData><row r="1"><c r="A1" t="inlineStr"><is>'
   +'<t>ADPHOR QA - DOCUMENTO SINTETICO - NO REAL</t>'
   +'</is></c></row></sheetData></worksheet>']
 ];
 throw Error('Formato Office sintético no autorizado.');
}
export function syntheticVisitOfficeBytes(kind){return packageZip(parts(kind));}
export function createSyntheticVisitOfficeFile(kind,FileClass=globalThis.File){
 const definition=SYNTHETIC_VISIT_OFFICE[kind];
 if(!definition||typeof FileClass!=='function')throw Error('El navegador no puede crear este documento Office.');
 return new FileClass([syntheticVisitOfficeBytes(kind)],definition.name,{type:definition.type});
}
