import {validateAgentScope} from './agent-api.js';
import {QA_URL} from './qa-auth-policy.js';

// Read-only, signed-in human queries. Supabase RLS with active-principal/AAL2
// is the server-side tenant boundary. Never select source_snapshot or write.
const UUID = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const STATUSES = new Set(['Pendiente de aprobación del administrador','Aprobado por el administrador','Rechazado por el administrador']);
const FIELDS = 'id,project_id,created_at,source_read_at,engine_kind,status,administrator_id,decided_at';

async function verifiedReader(client, qaUrl) {
  if (qaUrl !== QA_URL) throw Error('El historial solo permite Supabase QA Integral.');
  const {data:identity,error:userError}=await client.auth.getUser();
  if (userError || !identity?.user?.id) throw Error('Debes iniciar sesión nuevamente.');
  const {data:aal,error:aalError}=await client.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aalError || aal?.currentLevel !== 'aal2') throw Error('Completa la verificación MFA AAL2.');
}
export function validateQaAgentRows(rows, projectId, detail=false) {
  if (!Array.isArray(rows) || rows.length>20 || rows.some(r=>
    !r || r.project_id!==projectId || typeof r.id!=='string' || !UUID.test(r.id) ||
    !['rules','models'].includes(r.engine_kind) || !STATUSES.has(r.status) ||
    !Number.isFinite(Date.parse(r.source_read_at)) ||
    (detail && (typeof r.draft!=='string' || !/^[a-f0-9]{64}$/.test(r.result_hash))))) {
      throw Error('El historial devolvió registros inconsistentes o de otra copropiedad.');
  }
  return rows;
}
export async function qaAgentRegistryReadiness(client,{qaUrl,projectId}) {
  validateAgentScope(projectId);
  await verifiedReader(client,qaUrl);
  const {data,error}=await client.from('agent_run_status').select('id')
    .eq('project_id',projectId).limit(1);
  if (error || !Array.isArray(data) || data.some(r=>!UUID.test(String(r?.id)))) {
    throw Error('El registro protegido del enjambre no está disponible.');
  }
  // A database view is NOT attestation of an executable/approval backend.
  return Object.freeze({project_id:projectId,registry_ready:true,reviews_ready:false,
    rules_ready:false,models_ready:false,read_only:true});
}
export async function qaAgentRuns(client,{qaUrl,projectId,offset=0}) {
  validateAgentScope(projectId,offset);
  if(offset>10000)throw Error('La página del historial no es válida.');
  await verifiedReader(client,qaUrl);
  const {data,error}=await client.from('agent_run_status').select(FIELDS)
    .eq('project_id',projectId).order('created_at',{ascending:false})
    .order('id',{ascending:false}).range(offset,offset+19);
  if(error)throw Error('No se pudo consultar el historial protegido de QA.');
  return validateQaAgentRows(data,projectId);
}
export async function qaAgentRunDetail(client,{qaUrl,projectId,runId}) {
  validateAgentScope(projectId);
  if(typeof runId!=='string'||!UUID.test(runId))throw Error('El identificador del borrador no es válido.');
  await verifiedReader(client,qaUrl);
  const {data,error}=await client.from('agent_run_status')
    .select(FIELDS+',draft,result_hash,note').eq('project_id',projectId)
    .eq('id',runId).maybeSingle();
  if(error||!data)throw Error('El borrador no está disponible para esta copropiedad.');
  return validateQaAgentRows([data],projectId,true)[0];
}
