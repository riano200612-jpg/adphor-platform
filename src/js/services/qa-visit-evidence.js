import {validateQaVisitEvidence,normalizeQaVisitFileName,QA_VISIT_OFFICE_EXT} from './qa-visit-evidence-policy.js';
import {evidenceObjectId} from './qa-case-evidence.js';

const QA_URL='https://qfctnnnnltghepwujpdm.supabase.co';
const BUCKET='qa-visit-evidence';
const EXT={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','video/mp4':'mp4','video/webm':'webm','application/pdf':'pdf',...QA_VISIT_OFFICE_EXT};
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const projectKey=/^[a-z0-9][a-z0-9-]{0,99}$/;
const checked=result=>{if(result?.error)throw Error('No se pudo confirmar la evidencia privada de Visitas.');return result?.data;};

export async function officeEvidenceObjectId(file,projectId,requestId,actor){
 const ext=QA_VISIT_OFFICE_EXT[file?.type];
 if(!ext||typeof file.name!=='string'||!file.name.toLowerCase().endsWith('.'+ext))
  throw Error('Documento Office no autorizado.');
 const bytes=new Uint8Array(await file.arrayBuffer());
 if(bytes.length!==file.size||bytes.length<4||bytes.length>20971520||
    bytes[0]!==0x50||bytes[1]!==0x4b||bytes[2]!==0x03||bytes[3]!==0x04)
  throw Error('El documento Office no tiene una cabecera ZIP válida.');
 const prefix=new TextEncoder().encode(['ADPHOR-QA-VISIT-OFFICE-V1',projectId,requestId,actor,file.type].join('|')+'|');
 const data=new Uint8Array(prefix.length+bytes.length);
 data.set(prefix);data.set(bytes,prefix.length);
 const hash=new Uint8Array(await crypto.subtle.digest('SHA-256',data));
 const part=hash.slice(0,16);part[6]=(part[6]&15)|128;part[8]=(part[8]&63)|128;
 const hex=Array.from(part,b=>b.toString(16).padStart(2,'0')).join('');
 return [hex.slice(0,8),hex.slice(8,12),hex.slice(12,16),hex.slice(16,20),hex.slice(20,32)].join('-');
}

function scope(projectId,requestId){
 if(!projectKey.test(projectId??'')||!uuid.test(requestId??''))throw Error('Visita o copropiedad no válida.');
}
function checkRow(row,projectId,requestId){
 if(row?.project_id!==projectId||row?.request_id!==requestId||row?.storage_bucket!==BUCKET
  ||!uuid.test(row.id??'')||!uuid.test(row.uploaded_by??'')||!EXT[row.media_type]
  ||row.storage_path!==[projectId,'visitas',requestId,row.uploaded_by,row.id+'.'+EXT[row.media_type]].join('/')
  ||!Number.isSafeInteger(Number(row.file_bytes))||Number(row.file_bytes)<1||Number(row.file_bytes)>20971520
  ||(row.file_name!=null && (typeof row.file_name!=='string'||row.file_name.length>180||!row.file_name.trim()||row.file_name!==row.file_name.normalize('NFC').trim()||/[\\/<>\u0000-\u001F\u007F]/u.test(row.file_name))))
  throw Error('La evidencia no corresponde a la visita autorizada.');
 return row;
}

// Scope, MFA and role checks are repeated server-side by PostgreSQL and Storage RLS.
// This frontend never uses service_role, secret API keys or public Storage URLs.
export function createQaVisitEvidenceRepository(client,{url=QA_URL}={}){
 if(url!==QA_URL)throw Error('Evidencias de Visitas disponibles únicamente en Supabase QA.');
 async function authorize(projectId,requestId,write=false){
  scope(projectId,requestId);
  const assurance=checked(await client.auth.mfa.getAuthenticatorAssuranceLevel());
  if(assurance?.currentLevel!=='aal2')throw Error('Las evidencias privadas requieren MFA AAL2.');
  const {user}=checked(await client.auth.getUser());
  if(!uuid.test(user?.id??''))throw Error('Sesión QA requerida.');
  const members=checked(await client.from('memberships').select('role')
   .eq('project_id',projectId).eq('user_id',user.id).limit(1));
  const roles=write?['admin','coordinator']:['admin','coordinator','technician'];
  if(!Array.isArray(members)||members.length!==1||!roles.includes(members[0]?.role))
   throw Error('Copropiedad o función no autorizada.');
  const visit=checked(await client.from('qa_visits').select('project_id,request_id,status')
   .eq('project_id',projectId).eq('request_id',requestId).single());
  if(visit?.project_id!==projectId||visit?.request_id!==requestId)
   throw Error('Visita no autorizada.');
  if(write && !['programada','en_ejecucion'].includes(visit.status))
   throw Error('Una visita cerrada no admite nuevos adjuntos.');
  return user.id;
 }
 async function find(projectId,requestId,id){
  const rows=checked(await client.from('qa_visit_evidence')
   .select('id,project_id,request_id,storage_bucket,storage_path,media_type,file_bytes,uploaded_by,file_name,created_at')
   .eq('project_id',projectId).eq('request_id',requestId).eq('id',id).limit(1));
  if(!Array.isArray(rows)||rows.length>1)throw Error('Evidencia ambigua.');
  return rows.length?checkRow(rows[0],projectId,requestId):null;
 }
 return {
  async uploadEvidence({projectId,requestId,files}){
   scope(projectId,requestId);
   const selected=validateQaVisitEvidence(files);
   if(!selected.length)throw Error('Selecciona al menos un archivo autorizado.');
   const actor=await authorize(projectId,requestId,true);
   const confirmed=[];
   for(const file of selected){
    const fileName=normalizeQaVisitFileName(file);
    const id=QA_VISIT_OFFICE_EXT[file.type]?await officeEvidenceObjectId(file,projectId,requestId,actor):await evidenceObjectId(file,projectId,requestId,actor);
    const path=[projectId,'visitas',requestId,actor,id+'.'+EXT[file.type]].join('/');
    const previous=await find(projectId,requestId,id);
    if(previous){
     if(previous.uploaded_by!==actor||previous.storage_path!==path||previous.media_type!==file.type||Number(previous.file_bytes)!==file.size)
      throw Error('El archivo existente no coincide; no se reemplazó.');
     confirmed.push({id,project_id:projectId,request_id:requestId,storage_written:true,metadata_linked:true});
     continue;
    }
    const upload=await client.storage.from(BUCKET).upload(path,file,{upsert:false,contentType:file.type,cacheControl:'0'});
    if(upload.error && String(upload.error.statusCode??upload.error.status)!=='409')
      throw Error('No se confirmó la carga privada. Reintenta con el mismo archivo.');
    if(!upload.error && upload.data?.path!==path)
      throw Error('No se pudo verificar la ruta del archivo cargado.');
    const meta={id,project_id:projectId,request_id:requestId,storage_bucket:BUCKET,
      storage_path:path,media_type:file.type,file_bytes:file.size,uploaded_by:actor,file_name:fileName};
    const linked=await client.from('qa_visit_evidence').insert(meta)
      .select('id,project_id,request_id,storage_bucket,storage_path,media_type,file_bytes,uploaded_by,file_name,created_at').single();
    if(linked.error && linked.error.code!=='23505')
      throw Error('Archivo cargado, pero sin enlace a la visita. Reintenta el mismo archivo.');
    const row=linked.error?await find(projectId,requestId,id):checkRow(linked.data,projectId,requestId);
    if(!row||row.uploaded_by!==actor||row.storage_path!==path||row.media_type!==file.type||Number(row.file_bytes)!==file.size)
      throw Error('No se confirmó la asociación privada de la evidencia.');
    confirmed.push({id,project_id:projectId,request_id:requestId,storage_written:true,metadata_linked:true});
   }
   return confirmed;
  },
  async listEvidence(projectId,requestId){
   await authorize(projectId,requestId);
   const rows=checked(await client.from('qa_visit_evidence')
    .select('id,project_id,request_id,storage_bucket,storage_path,media_type,file_bytes,uploaded_by,file_name,created_at')
    .eq('project_id',projectId).eq('request_id',requestId)
    .order('created_at',{ascending:true}).order('id',{ascending:true}).limit(51));
   if(!Array.isArray(rows)||rows.length>50)throw Error('El historial de evidencias es incompleto.');
   return rows.map(row=>checkRow(row,projectId,requestId));
  },
  // Newest-first key-scoped pages avoid a permanent read failure at 51 files.
  // The extra row is a bounded lookahead; each request rechecks MFA and membership.
  async listEvidencePage(projectId,requestId,offset=0){
   if(!Number.isSafeInteger(offset)||offset<0||offset>100000)
    throw Error('Paginación de evidencias no válida.');
   await authorize(projectId,requestId);
   const rows=checked(await client.from('qa_visit_evidence')
    .select('id,project_id,request_id,storage_bucket,storage_path,media_type,file_bytes,uploaded_by,file_name,created_at')
    .eq('project_id',projectId).eq('request_id',requestId)
    .order('created_at',{ascending:false}).order('id',{ascending:false})
    .range(offset,offset+50));
   if(!Array.isArray(rows)||rows.length>51)
    throw Error('Página de evidencias no válida.');
   const validated=rows.map(row=>checkRow(row,projectId,requestId));
   return {rows:validated.slice(0,50),hasMore:validated.length>50};
  },
  async signedEvidence(projectId,requestId,id){
   await authorize(projectId,requestId);
   if(!uuid.test(id??''))throw Error('Identificador de evidencia no válido.');
   const row=await find(projectId,requestId,id);
   if(!row)throw Error('Evidencia privada no encontrada.');
   const result=checked(await client.storage.from(BUCKET).createSignedUrl(row.storage_path,90));
   if(!result?.signedUrl)throw Error('No fue posible preparar el enlace privado.');
   const url=new URL(result.signedUrl,QA_URL);
   if(url.origin!==QA_URL||!url.pathname.startsWith('/storage/v1/object/sign/'+BUCKET+'/'))
     throw Error('El destino del archivo no es confiable.');
   return url.toString();
  }
 };
}
