import {calendarInstant} from './calendar-availability.js';
import {visitActions,visitStates,visitTransitionPayload} from './visit-lifecycle.js';
const checked=result=>{if(result.error)throw Error('No se pudo confirmar la operación de Visitas.');return result.data;};
export function createSharedVisitRepository(client,{url,writesEnabled=false,lifecycleEnabled=false}){
 if(url!=='https://qfctnnnnltghepwujpdm.supabase.co')return null;
 const allowedWrites=writesEnabled===true;
 const lifecycle=allowedWrites&&lifecycleEnabled===true;
 async function authorize(projectId,write=false){
  if(!projectId)throw Error('Copropiedad requerida.');
  const level=checked(await client.auth.mfa.getAuthenticatorAssuranceLevel());
  if(level?.currentLevel!=='aal2')throw Error('Visitas requiere MFA AAL2.');
  const {user}=checked(await client.auth.getUser());if(!user?.id)throw Error('Sesión requerida.');
  const memberships=checked(await client.from('memberships').select('role').eq('project_id',projectId).eq('user_id',user.id).limit(1));
  if(memberships?.length!==1||write&&!['admin','coordinator'].includes(memberships[0].role))throw Error('Copropiedad no autorizada.');
  return user.id;
 }
 return {
  writesEnabled:allowedWrites,
  lifecycleEnabled:lifecycle,
  async transition({projectId,requestId,operationId,version,status,action,values}){
   if(!lifecycle)throw Error('Seguimiento de Visitas deshabilitado.');
   await authorize(projectId,true);
   if(!visitActions(status).includes(action)||!Number.isInteger(version)||version<1||!operationId||!requestId)throw Error('Operación de visita no válida.');
   const payload=visitTransitionPayload(action,values);
   const data=checked(await client.rpc('qa_transition_visit',{p_project:projectId,p_request:requestId,p_operation:operationId,p_version:version,p_action:action,p_payload:payload}));
   const row=Array.isArray(data)&&data.length===1?data[0]:data;
   const expected=action==='start'?'en_ejecucion':action==='finish'?'completada':action==='cancel'?'cancelada':status;
   if(row?.project_id!==projectId||row.request_id!==requestId||row.version!==version+1||row.status!==expected)throw Error('Confirmación de visita no válida.');
   return row;
  },
  async history(projectId,requestId){
   if(!lifecycle)throw Error('Historial de Visitas deshabilitado.');
   await authorize(projectId);
   const rows=[];
   for(let offset=0;;offset+=500){
    const page=checked(await client.from('qa_visit_history').select('project_id,request_id,version,action,actor_id,occurred_at,snapshot').eq('project_id',projectId).eq('request_id',requestId).order('version').range(offset,offset+499));
    if(!Array.isArray(page)||page.some(row=>row.project_id!==projectId||row.request_id!==requestId))throw Error('Historial de visitas no válido.');
    rows.push(...page);if(page.length<500)return rows;
   }
  },
  async save({projectId,requestId,responsibleId,kind,start}){
   if(!allowedWrites)throw Error('Registro de Visitas deshabilitado; no se guardó la solicitud.');
   const actor=await authorize(projectId,true);
   if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(start??'')||!Number.isFinite(calendarInstant(start+':00-05:00')))throw Error('Fecha de visita no válida.');
   const data=checked(await client.rpc('qa_create_visit',{p_project:projectId,p_request:requestId,p_responsible:responsibleId,p_motive:kind,p_scheduled:start+'-05:00'}));
   if(Array.isArray(data)&&data.length!==1)throw Error('Confirmación de visita no válida.');
   const saved=Array.isArray(data)?data[0]:data;
   if(saved?.project_id!==projectId||saved.request_id!==requestId||saved.created_by!==actor||saved.responsible_id!==responsibleId||typeof kind!=='string'||saved.motive!==kind.replace(/^ +| +$/g,'')||calendarInstant(saved.scheduled_at)!==calendarInstant(start+':00-05:00'))throw Error('Confirmación de visita no válida.');
   return saved;
  },
  async list(projectId){
   await authorize(projectId);
   const rows=[];
   for(let offset=0;;offset+=500){
    const columns='project_id,request_id,responsible_id,motive,scheduled_at,created_by,created_at'+(lifecycle?',status,version,started_at,finished_at,observations,activities,conclusions,commitments,cancellation_reason':'');
    const page=checked(await client.from('qa_visits').select(columns).eq('project_id',projectId).order('scheduled_at').order('request_id').range(offset,offset+499));
    if(!Array.isArray(page)||page.some(row=>row.project_id!==projectId))throw Error('Respuesta de visitas no válida.');
    if(lifecycle&&page.some(row=>!Object.hasOwn(visitStates,row.status)||!Number.isInteger(row.version)||row.version<1))throw Error('Contrato de seguimiento de visitas no disponible.');
    rows.push(...page);if(page.length<500)return rows;
   }
  }
 };
}
