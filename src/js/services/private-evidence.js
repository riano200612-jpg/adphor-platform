// Private evidence storage contract; no upload is attempted without an authenticated backend.
import {validateQaEvidence} from './qa-evidence-policy.js';
export function createEvidenceUploadPlan({projectId,caseId,files,kind='pqrs'}={}) {
 if(typeof projectId!=='string'||!projectId.trim()||typeof caseId!=='string'||!caseId.trim())throw Error('Caso y copropiedad requeridos');
 if(!['pqrs','recorridos'].includes(kind))throw Error('Tipo de evidencia no autorizado');
 const selected=validateQaEvidence(files);
 return selected.map(file=>({project_id:projectId,case_id:caseId,kind,
   name:file.name,type:file.type,size:file.size,status:'awaiting_private_upload'}));
}
export async function uploadPrivateEvidence({repository,projectId,caseId,files,kind='pqrs'}={}) {
 const plan=createEvidenceUploadPlan({projectId,caseId,files,kind});
 if(!plan.length)return [];
 if(typeof repository?.uploadEvidence!=='function')throw Error('Almacenamiento privado no configurado. No se cargaron los archivos.');
 // Server must verify authentication, tenant access, content type, file quota and audit trail.
 return repository.uploadEvidence({projectId,caseId,kind,files:Array.from(files)});
}
