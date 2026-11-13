import {validateQaEvidence} from './qa-evidence-policy.js';

const QA_URL='https://qfctnnnnltghepwujpdm.supabase.co';
const BUCKET='qa-case-evidence';
const EXT={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','video/mp4':'mp4','video/webm':'webm','application/pdf':'pdf'};
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const projectKey=/^[a-z0-9][a-z0-9-]{0,99}$/;
const checked=result=>{if(result?.error)throw Error('No se pudo verificar el registro privado de evidencias.');return result?.data;};

function scoped(projectId,caseId,kind='pqrs'){
 if(!projectKey.test(projectId??'')||!uuid.test(caseId??'')||kind!=='pqrs')throw Error('Radicado o copropiedad no autorizado.');
}
export async function evidenceObjectId(file,projectId,caseId,userId){
 if(!uuid.test(caseId)||!uuid.test(userId)||!projectKey.test(projectId)||!EXT[file?.type])
  throw Error('No se puede identificar la evidencia del radicado.');
 const content=new Uint8Array(await file.arrayBuffer());
 if(content.length!==file.size||!content.length||content.length>20971520)throw Error('Tamaño de evidencia no válido.');
 const prefix=new TextEncoder().encode(['ADPHOR-QA-EVIDENCE-V1',projectId,caseId,userId,file.type].join('|')+'|');
 const data=new Uint8Array(prefix.length+content.length);
 data.set(prefix);data.set(content,prefix.length);
 const hash=new Uint8Array(await crypto.subtle.digest('SHA-256',data));
 const bytes=hash.slice(0,16);
 bytes[6]=(bytes[6]&15)|128; // UUID v8: application-defined deterministic digest
 bytes[8]=(bytes[8]&63)|128;
 const h=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
 return [h.slice(0,8),h.slice(8,12),h.slice(12,16),h.slice(16,20),h.slice(20,32)].join('-');
}

// This repository only ever operates under the signed-in user's JWT + RLS.
// No admin key, no cross-property browsing and no public Storage URLs.
export function createQaCaseEvidenceRepository(client,{url=QA_URL}={}){
 if(url!==QA_URL)throw Error('El almacenamiento está restringido al Supabase QA autorizado.');
 async function authorize(projectId,caseId){
  scoped(projectId,caseId);
  const assurance=checked(await client.auth.mfa.getAuthenticatorAssuranceLevel());
  if(assurance?.currentLevel!=='aal2')throw Error('La evidencia privada requiere MFA AAL2.');
  const {user}=checked(await client.auth.getUser());
  if(!uuid.test(user?.id??''))throw Error('Sesión QA requerida.');
  const members=checked(await client.from('memberships').select('role').eq('project_id',projectId).eq('user_id',user.id).limit(1));
  if(!Array.isArray(members)||members.length!==1||!['admin','coordinator','technician'].includes(members[0].role))throw Error('Copropiedad no autorizada.');
  const record=checked(await client.from('pilot_pqrs').select('id,project_id').eq('id',caseId).eq('project_id',projectId).single());
  if(record?.id!==caseId||record?.project_id!==projectId)throw Error('Radicado no autorizado.');
  return user.id;
 }
 async function readEvidence(projectId,caseId,id){
  const rows=checked(await client.from('qa_case_evidence')
   .select('id,project_id,case_id,storage_bucket,storage_path,media_type,file_bytes,created_at,uploaded_by')
   .eq('project_id',projectId).eq('case_id',caseId).eq('id',id).limit(1));
  if(!Array.isArray(rows)||rows.length!==1)return null;
  const row=rows[0];
  if(row.id!==id||row.project_id!==projectId||row.case_id!==caseId||row.storage_bucket!==BUCKET
     ||!row.storage_path.startsWith(projectId+'/pqrs/'+caseId+'/'))throw Error('La evidencia no corresponde al radicado.');
  return row;
 }
 return {
  async uploadEvidence({projectId,caseId,kind='pqrs',files}){
   scoped(projectId,caseId,kind);
   const selected=validateQaEvidence(files);
   if(!selected.length)throw Error('Selecciona una evidencia válida.');
   const actor=await authorize(projectId,caseId);
   const confirmed=[];
   for(const file of selected){
    const id=await evidenceObjectId(file,projectId,caseId,actor);
    const path=[projectId,'pqrs',caseId,actor,id+'.'+EXT[file.type]].join('/');
    const previous=await readEvidence(projectId,caseId,id);
    if(previous){
      if(previous.storage_path!==path||previous.uploaded_by!==actor||previous.media_type!==file.type||Number(previous.file_bytes)!==file.size)
       throw Error('Evidencia existente incompatible; no se sobrescribió.');
      confirmed.push({id,project_id:projectId,case_id:caseId,visibility:'private',storage_written:true,metadata_linked:true});
      continue;
    }
    const uploaded=await client.storage.from(BUCKET).upload(path,file,{upsert:false,contentType:file.type,cacheControl:'0'});
    // A retry may find the object already written but its metadata still pending.
    if(uploaded.error && String(uploaded.error.statusCode??uploaded.error.status)!=='409')
      throw Error('No se pudo confirmar la carga privada. Conserva el radicado y reintenta.');
    if(!uploaded.error && uploaded.data?.path!==path)
      throw Error('La ruta de almacenamiento no coincide con el radicado.');
    const metadata={id,project_id:projectId,case_id:caseId,case_kind:'pqrs',storage_bucket:BUCKET,
      storage_path:path,media_type:file.type,file_bytes:file.size,uploaded_by:actor};
    const result=await client.from('qa_case_evidence').insert(metadata).select('id,project_id,case_id,storage_path,storage_bucket,uploaded_by').single();
    if(result.error && result.error.code!=='23505')throw Error('Archivo cargado sin enlace de seguimiento confirmado. Reintenta el mismo archivo.');
    const saved=result.error?await readEvidence(projectId,caseId,id):result.data;
    if(!saved||saved.id!==id||saved.project_id!==projectId||saved.case_id!==caseId||saved.storage_path!==path||saved.storage_bucket!==BUCKET||saved.uploaded_by!==actor)
      throw Error('La evidencia no quedó asociada al radicado. Reintenta sin duplicar la PQRS.');
    confirmed.push({id,project_id:projectId,case_id:caseId,visibility:'private',storage_written:true,metadata_linked:true});
   }
   return confirmed;
  },
  async listEvidence(projectId,caseId){
   await authorize(projectId,caseId);
   const rows=checked(await client.from('qa_case_evidence')
    .select('id,project_id,case_id,storage_bucket,storage_path,media_type,file_bytes,created_at')
    .eq('project_id',projectId).eq('case_id',caseId)
    .order('created_at',{ascending:true}).order('id',{ascending:true}).limit(51));
   if(!Array.isArray(rows)||rows.length>50||rows.some(row=>row.project_id!==projectId||row.case_id!==caseId||row.storage_bucket!==BUCKET))
    throw Error('La consulta de evidencias es incompleta o no autorizada.');
   return rows;
  },
  async signedEvidence(projectId,caseId,id){
   await authorize(projectId,caseId);
   if(!uuid.test(id??''))throw Error('Identificador de evidencia inválido.');
   const row=await readEvidence(projectId,caseId,id);
   if(!row)throw Error('No se encontró una evidencia autorizada.');
   const signed=checked(await client.storage.from(BUCKET).createSignedUrl(row.storage_path,90));
   if(!signed?.signedUrl)throw Error('No se pudo generar un enlace privado.');
   const url=new URL(signed.signedUrl,QA_URL);
   if(url.origin!==QA_URL||!url.pathname.startsWith('/storage/v1/object/sign/'+BUCKET+'/'))
    throw Error('Destino de archivo no autorizado.');
   return url.toString();
  }
 };
}
