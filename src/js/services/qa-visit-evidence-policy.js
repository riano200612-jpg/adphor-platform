import {QA_EVIDENCE_TYPES,QA_EVIDENCE_MAX_BYTES,QA_EVIDENCE_MAX_FILES} from './qa-evidence-policy.js';
// Visitas only: modern OpenXML. Macro-enabled and legacy Office files are not accepted.
export const QA_VISIT_OFFICE_EXT=Object.freeze({
 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':'docx',
 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':'xlsx'
});
export const QA_VISIT_EVIDENCE_TYPES=Object.freeze([...QA_EVIDENCE_TYPES,...Object.keys(QA_VISIT_OFFICE_EXT)]);

export function normalizeQaVisitFileName(file){
 if(typeof file?.name!=='string')throw Error('El archivo necesita un nombre válido.');
 const name=file.name.normalize('NFC').trim();
 if(!name||name.length>180||/[\/\\<>\u0000-\u001F\u007F]/u.test(name))
  throw Error('Nombre de archivo no permitido (máximo 180 caracteres).');
 return name;
}

export function validateQaVisitEvidence(files){
 const items=Array.from(files||[]);
 if(items.length>QA_EVIDENCE_MAX_FILES)throw Error('Selecciona máximo cinco archivos.');
 const allowed=new Set(QA_VISIT_EVIDENCE_TYPES);
 for(const file of items){
  normalizeQaVisitFileName(file);
  if(!file||!allowed.has(file.type)||!Number.isSafeInteger(file.size)||file.size<1||file.size>QA_EVIDENCE_MAX_BYTES)
   throw Error('Archivo no permitido o superior a 20 MB.');
  const ext=QA_VISIT_OFFICE_EXT[file.type];
  if(ext&&(typeof file.name!=='string'||!file.name.toLowerCase().endsWith('.'+ext)))
   throw Error('El tipo y la extensión del documento no coinciden.');
 }
 return items;
}
