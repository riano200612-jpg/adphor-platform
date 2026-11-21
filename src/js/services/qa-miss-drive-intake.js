import {validateQaVisitOfficePackage} from './qa-visit-ooxml-inspector.js';
// Miss ADPHOR QA Integral: private, per-property intake into quarantine only.
// Google Drive URLs are references, never proof that the app can download the file.
// No AI ingestion, report publishing, automatic permissions or Google writes.
export const MISS_DOCUMENT_BUCKET = 'qa-miss-documents';
export const MISS_DOCUMENT_TABLE = 'qa_miss_document_submissions';
export const MISS_DOCUMENT_MAX_BYTES = 15 * 1024 * 1024;
const QA_URL = 'https://qfctnnnnltghepwujpdm.supabase.co';
const PROJECT = /^[a-z0-9][a-z0-9_-]{0,99}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DRIVE_ID = /^[A-Za-z0-9_-]{12,150}$/;
const TYPES = Object.freeze({
 'application/pdf': ['pdf', 'pdf'],
 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['docx', 'zip'],
 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['xlsx', 'zip'],
});
const fields = 'id,project_id,uploaded_by,source_kind,display_name,drive_file_id,drive_kind,object_path,media_type,file_bytes,sha256,review_state,created_at';

export function driveSourceFromUrl(input) {
 let url;
 try { url = new URL(String(input ?? '').trim()); } catch { throw Error('Introduce el enlace directo de un archivo de Google Drive.'); }
 if(url.protocol !== 'https:' || url.username || url.password || url.port || url.hash)
  throw Error('El enlace de Drive debe ser HTTPS y no incluir credenciales ni fragmentos.');
 let match, kind;
 if(url.hostname === 'drive.google.com') {
  match = /^\/file\/d\/([A-Za-z0-9_-]+)(?:\/(?:view|preview|edit))?\/?$/.exec(url.pathname);
  kind = 'file';
 } else if(url.hostname === 'docs.google.com') {
  match = /^\/(document|spreadsheets|presentation)\/d\/([A-Za-z0-9_-]+)(?:\/(?:edit|view|preview))?\/?$/.exec(url.pathname);
  kind = match?.[1] ?? '';
 } else throw Error('Solo se admiten enlaces directos de Google Drive.');
 const id = url.hostname === 'drive.google.com' ? match?.[1] : match?.[2];
 if(!DRIVE_ID.test(id ?? '')) throw Error('El identificador del archivo de Drive no es válido.');
 return Object.freeze({fileId:id, kind, url:url.origin+url.pathname});
}
export function missDocumentName(value) {
 const name = String(value ?? '').trim();
 if(name.length<3 || name.length>180 || /[\x00-\x1f\x7f<>\\/]/.test(name))
  throw Error('El nombre del documento debe tener de 3 a 180 caracteres, sin rutas ni controles.');
 return name;
}
export function validateMissDocumentFile(file) {
 if(!file || !Number.isSafeInteger(file.size) || file.size<1 ||
    file.size>MISS_DOCUMENT_MAX_BYTES || !Object.hasOwn(TYPES,file.type))
  throw Error('Admite PDF, DOCX y XLSX de máximo 15 MB.');
 const name=missDocumentName(file.name);
 const [extension]=TYPES[file.type];
 if(!name.toLowerCase().endsWith('.'+extension)) throw Error('La extensión y el tipo del archivo no coinciden.');
 if(typeof file.arrayBuffer!=='function')throw Error('El archivo no es legible.');
 return Object.freeze({name,extension,mediaType:file.type,size:file.size});
}
async function digestFile(file,extension) {
 const bytes=new Uint8Array(await file.arrayBuffer());
 if(bytes.length!==file.size)throw Error('No fue posible comprobar el archivo completo.');
 const isPdf=extension==='pdf';
 const signature=isPdf
  ? bytes.length>=5 && [37,80,68,70,45].every((b,i)=>bytes[i]===b)
  : bytes.length>=4 && [80,75,3,4].every((b,i)=>bytes[i]===b);
 if(!signature)throw Error('El encabezado del archivo no coincide con su formato.');
 if(!isPdf)await validateQaVisitOfficePackage(bytes,extension);
 const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes));
 return Array.from(digest,b=>b.toString(16).padStart(2,'0')).join('');
}
function unwrap(response,message) {
 if(response?.error)throw Error(message);
 return response?.data;
}
export function createQaMissDocumentIntake(client,{url=QA_URL}={}) {
 if(url!==QA_URL)throw Error('La bandeja documental solo opera con la base QA aislada.');
 async function actorFor(projectId) {
  if(typeof projectId!=='string'||!PROJECT.test(projectId))throw Error('Selecciona una copropiedad válida.');
  const assurance=unwrap(await client.auth.mfa.getAuthenticatorAssuranceLevel(),'No se pudo verificar MFA.');
  if(assurance?.currentLevel!=='aal2')throw Error('Para aportar archivos privados debes completar MFA AAL2.');
  const user=unwrap(await client.auth.getUser(),'Se requiere sesión autorizada.')?.user;
  if(!UUID.test(user?.id??''))throw Error('Se requiere sesión autorizada.');
  const members=unwrap(await client.from('memberships').select('role').eq('project_id',projectId).eq('user_id',user.id).limit(2),
    'No se pudo comprobar tu copropiedad.');
  if(!Array.isArray(members)||members.length!==1||!members[0]?.role)
   throw Error('No tienes autorización para aportar documentos a esta copropiedad.');
  return user.id;
 }
 async function findOwn(projectId,userId,column,value) {
  const values=unwrap(await client.from(MISS_DOCUMENT_TABLE).select(fields).eq('project_id',projectId)
    .eq('uploaded_by',userId).eq(column,value).limit(2),'No se pudo verificar el duplicado.');
  if(!Array.isArray(values)||values.length>1||
     values.some(x=>x?.project_id!==projectId||x?.uploaded_by!==userId||x?.[column]!==value||
       x?.review_state!=='quarantined'))throw Error('El documento registrado no es verificable.');
  return values[0]??null;
 }
 async function fetchOwn(projectId,userId) {
  const data=unwrap(await client.from(MISS_DOCUMENT_TABLE).select(fields).eq('project_id',projectId)
    .eq('uploaded_by',userId).order('created_at',{ascending:false}).limit(50),'No se pudo leer la bandeja privada.');
  if(!Array.isArray(data)||data.length>50||data.some(x=>x?.project_id!==projectId||x?.uploaded_by!==userId||
    x?.review_state!=='quarantined'))
   throw Error('La bandeja devolvió registros no verificables.');
  return data;
 }
 return Object.freeze({
  async listOwn(projectId){const actor=await actorFor(projectId);return fetchOwn(projectId,actor);},
  async addDriveLink(projectId,link,name) {
   const actor=await actorFor(projectId);
   const source=driveSourceFromUrl(link);
   const displayName=missDocumentName(name);
   const record={project_id:projectId,uploaded_by:actor,source_kind:'drive_link',
     display_name:displayName,drive_file_id:source.fileId,drive_kind:source.kind,review_state:'quarantined'};
   const result=await client.from(MISS_DOCUMENT_TABLE).insert(record).select(fields).single();
   if(result.error?.code==='23505') {
    const previous=await findOwn(projectId,actor,'drive_file_id',source.fileId);
    if(previous?.source_kind==='drive_link')return previous;
   }
   const saved=unwrap(result,'No se confirmó el registro de Drive; no hay importación automática.');
   if(saved?.project_id!==projectId||saved?.uploaded_by!==actor||saved?.review_state!=='quarantined'||
     saved?.drive_file_id!==source.fileId)throw Error('No se verificó la cuarentena del enlace.');
   return saved;
  },
  async addLocalFile(projectId,file) {
   const actor=await actorFor(projectId);
   const details=validateMissDocumentFile(file);
   const sha256=await digestFile(file,details.extension);
   const path=[projectId,actor,sha256+'.'+details.extension].join('/');
   const uploaded=await client.storage.from(MISS_DOCUMENT_BUCKET).upload(path,file,{
    upsert:false,contentType:details.mediaType,cacheControl:'0'
   });
   // Supabase Storage can report a genuine duplicate as 400/409 depending on API version.
   // Never treat an unrelated 400 or a failed upload as a successful file contribution.
   const code=String(uploaded.error?.code??uploaded.error?.error??'');
   const status=String(uploaded.error?.statusCode??uploaded.error?.status??'');
   const duplicate=uploaded.error && (
     ['ResourceAlreadyExists','KeyAlreadyExists','already_exists'].includes(code) ||
     (['400','409'].includes(status) && /^(?:asset already exists|the resource already exists)$/i.test(
       String(uploaded.error?.message??'').trim())));
   if(uploaded.error){
    if(!duplicate)throw Error('No se confirmó el almacenamiento privado. Reintenta sin cambiar el documento.');
    const previous=await findOwn(projectId,actor,'object_path',path);
    if(previous?.source_kind==='upload' && previous.sha256===sha256 &&
       previous.media_type===details.mediaType && Number(previous.file_bytes)===details.size)return previous;
    throw Error('El archivo existe en cuarentena, pero no se verificó su registro. Solicita revisión al administrador de QA.');
   }
   if(uploaded.data?.path!==path)throw Error('La ruta de Storage no coincide con el archivo.');
   const record={project_id:projectId,uploaded_by:actor,source_kind:'upload',
    display_name:details.name,media_type:details.mediaType,file_bytes:details.size,
    object_path:path,sha256,review_state:'quarantined'};
   const result=await client.from(MISS_DOCUMENT_TABLE).insert(record).select(fields).single();
   if(result.error?.code==='23505'){
    const previous=await findOwn(projectId,actor,'object_path',path);
    if(previous?.source_kind==='upload'&&previous.media_type===details.mediaType&&
       Number(previous.file_bytes)===details.size&&previous.sha256===sha256)return previous;
   }
   const saved=unwrap(result,'Archivo recibido por Storage, pero sin registro documental confirmado. Reintenta el mismo archivo.');
   if(saved?.project_id!==projectId||saved?.uploaded_by!==actor||
      saved?.review_state!=='quarantined'||saved?.media_type!==details.mediaType||
      saved?.object_path!==path||saved?.sha256!==sha256||
      Number(saved?.file_bytes)!==details.size)
     throw Error('No se confirmó el registro del documento en cuarentena.');
   return saved;
  }
 });
}
