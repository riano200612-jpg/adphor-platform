// QA IAM Pages gate. Explicitly disabled until owner certification and private secrets.
const QA_ORIGIN='https://qa-integral-claude-reviewed.adphor-platform.pages.dev';
const QA_URL='https://qfctnnnnltghepwujpdm.supabase.co';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLES=new Set(['admin','coordinator','technician','viewer']);
const HEADERS={'Cache-Control':'no-store, max-age=0','Content-Type':'application/json; charset=utf-8',
 'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'};
function json(status,data){return new Response(JSON.stringify(data),{status,headers:HEADERS});}
const deny=(status)=>json(status,{error:status===503?'Servicio administrativo pendiente de certificación.':'Operación no autorizada.'});
const safe=(x)=>typeof x==='string'?x.trim():'';
function validateAssignments(x){
 if(!Array.isArray(x)||x.length<1||x.length>100)throw Error('Invalid assignments');
 const unique=new Set();
 const items=x.map(a=>{
   const project_id=safe(a?.project_id),role=safe(a?.role);
   if(!project_id||project_id.length>100||!ROLES.has(role)||unique.has(project_id))throw Error('Invalid assignments');
   unique.add(project_id);return {project_id,role};
 });
 return items;
}
function validateCommand(x){
 if(!x || typeof x!=='object'||Array.isArray(x))throw Error('Invalid body');
 const action=safe(x.action), email=safe(x.email).toLowerCase();
 const reason=safe(x.reason),requestId=safe(x.requestId);
 if(!['invite','grant','suspend','offboard'].includes(action)||
   email.length>254||!EMAIL.test(email)||reason.length<8||reason.length>500||!UUID.test(requestId))throw Error('Invalid command');
 const name=safe(x.name);
 const assignments=action==='invite'||action==='grant'?validateAssignments(x.assignments):[];
 if(action==='invite' && (!name||name.length>120))throw Error('Invalid name');
 return {action,email,reason,requestId,name,assignments};
}
async function rpc(client,name,args){
 const {data,error}=await client.rpc(name,args);
 if(error)throw Error('IAM_RPC_FAILED');
 return data;
}
function params(identity,c,override){
 return {p_actor:identity.userId,p_session:identity.sessionId,p_request:override?.requestId||c.requestId,
  p_action:override?.action||c.action,p_email:c.email,p_name:c.name||'',p_user:override?.userId||null,
  p_assignments:c.assignments,p_reason:c.reason};
}
export function createIamQaHandler(makeClient){
 if(typeof makeClient!=='function')throw Error('A client factory is required');
 return async ({request,env})=>{
  const u=new URL(request.url);
  if(u.origin!==QA_ORIGIN ||u.pathname!=='/api/iam'||u.search)return deny(404);
  if(!['GET','POST'].includes(request.method))return deny(405);
  const origin=request.headers.get('Origin');
  if((origin!==null&&origin!==QA_ORIGIN)||(request.method==='POST'&&origin!==QA_ORIGIN))return deny(403);
  // No automatic activation on previews or production. Never trust client-side toggles.
  if(env?.ADPHOR_QA_IAM_ENABLED!=='true' ||
    env?.ADPHOR_QA_IAM_REF!=='qfctnnnnltghepwujpdm' ||
    !safe(env?.SUPABASE_SERVICE_ROLE_KEY))return deny(503);
  const header=request.headers.get('Authorization')||'';
  const found=/^Bearer ([A-Za-z0-9._-]{40,5000})$/.exec(header);
  if(!found)return deny(401);
  let client;
  try{client=makeClient(QA_URL,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{
   persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});}
  catch{return deny(503);}
  try {
   const token=found[1];
   const [{data:userData,error:userError},{data:claimData,error:claimsError}]=await Promise.all([
    client.auth.getUser(token),client.auth.getClaims(token)]);
   const user=userData?.user,claims=claimData?.claims;
   if(userError||claimsError||!user?.id||!claims||claims.sub!==user.id||claims.aal!=='aal2'||
     !UUID.test(claims.session_id))return deny(403);
   const identity={userId:user.id,sessionId:claims.session_id};
   const operator=await rpc(client,'qa_iam_is_operator',{p_user:identity.userId,p_session:identity.sessionId});
   if(operator!==true)return deny(403);
   if(request.method==='GET'){
     const snapshot=await rpc(client,'qa_iam_snapshot',{p_actor:identity.userId,p_session:identity.sessionId});
     if(!snapshot||!Array.isArray(snapshot.accounts)||!Array.isArray(snapshot.audit))return deny(503);
     return json(200,{enabled:true,admin_state:snapshot.admin_state||null,accounts:snapshot.accounts,audit:snapshot.audit});
   }
   const raw=await request.text();
   if(raw.length>12000)return deny(413);
   let command;
   try{command=validateCommand(JSON.parse(raw));}catch{return deny(400);}
   const c=command;
   if(c.action==='invite'){
     // Hook permits creation for a short window only after the private DB preparation.
     await rpc(client,'qa_iam_command',params(identity,c,{action:'prepare_invite'}));
     let invited;
     try {
       const response=await client.auth.admin.inviteUserByEmail(c.email,{redirectTo:QA_ORIGIN+'/'});
       if(response.error||!response.data?.user?.id)throw Error('INVITE_FAILED');
       invited=response.data.user;
     } catch {
       try {await rpc(client,'qa_iam_command',params(identity,c,
        {action:'cancel_invite',requestId:crypto.randomUUID()}));}catch{}
       return json(503,{error:'No se pudo enviar la invitación. Revisa auditoría antes de reintentar.'});
     }
     try {
       await rpc(client,'qa_iam_command',params(identity,c,
        {action:'link_invite',requestId:crypto.randomUUID(),userId:invited.id}));
       return json(201,{status:'invited',email:c.email});
     } catch {
       // Do not delete an Auth user automatically; reconciliation must identify the exact record.
       return json(202,{status:'pending_reconciliation',message:'Invitación emitida; falta vincular permisos.'});
     }
   }
   const result=await rpc(client,'qa_iam_command',params(identity,c));
   if(c.action==='suspend'||c.action==='offboard'){
     if(!result?.user_id)return deny(503);
     const ban=await client.auth.admin.updateUserById(result.user_id,{ban_duration:'876000h'});
     if(ban.error)return json(202,{status:'access_restricted_auth_pending',message:'Permisos retirados; bloqueo Auth requiere conciliación.'});
     // If the follow-up audit fails, Auth was banned but must still be reconciled.
     try{await rpc(client,'qa_iam_command',params(identity,c,{
       action:'confirm_auth_ban',requestId:crypto.randomUUID()}));}
     catch{return json(202,{status:'auth_banned_audit_pending'});}
     return json(200,{status:'offboard_complete',action:c.action});
   }
   return json(200,{status:'permissions_updated',action:c.action});
  }catch{return deny(503);}
 };
}
