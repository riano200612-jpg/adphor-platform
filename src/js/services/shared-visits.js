import {calendarInstant} from './calendar-availability.js';
const checked=result=>{if(result.error)throw Error('No se pudo confirmar la operación de Visitas.');return result.data;};
export function createSharedVisitRepository(client,{url,writesEnabled=false}){
 if(url!=='https://qfctnnnnltghepwujpdm.supabase.co')return null;
 const allowedWrites=writesEnabled===true;
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
    const page=checked(await client.from('qa_visits').select('project_id,request_id,responsible_id,motive,scheduled_at,created_by,created_at').eq('project_id',projectId).order('scheduled_at').order('request_id').range(offset,offset+499));
    if(!Array.isArray(page)||page.some(row=>row.project_id!==projectId))throw Error('Respuesta de visitas no válida.');
    rows.push(...page);if(page.length<500)return rows;
   }
  }
 };
}
