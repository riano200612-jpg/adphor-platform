// Shared PQRS/Recorridos evidence policy. No upload or external requests.
export const QA_EVIDENCE_TYPES = Object.freeze(['image/jpeg','image/png','image/webp','video/mp4','video/webm','application/pdf']);
export const QA_EVIDENCE_MAX_FILES = 5;
export const QA_EVIDENCE_MAX_BYTES = 20*1024*1024;
export function validateQaEvidence(files) {
 const items=Array.from(files||[]);
 if(items.length>QA_EVIDENCE_MAX_FILES)throw Error('Selecciona máximo cinco archivos.');
 const allowed=new Set(QA_EVIDENCE_TYPES);
 for(const item of items) {
  if(!item || !allowed.has(item.type) || !Number.isSafeInteger(item.size) || item.size<1 || item.size>QA_EVIDENCE_MAX_BYTES)throw Error('Archivo no permitido o superior a 20 MB.');
 }
 return items;
}
