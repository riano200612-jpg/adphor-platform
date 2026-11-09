// Private QA read-only catalog. No service-role key, historical import or mutations.
// Requires verified Supabase JWT, aal2, admin membership, PostgreSQL RLS, exact QA project.
// The separate Cloudflare Pages UI MUST remain protected by Access independently.
import { createClient } from 'npm:@supabase/supabase-js@2.118.0';

const QA_URL='https://qfctnnnnltghepwujpdm.supabase.co';
const QA_ORIGIN='https://qa-pqrs-carrusel-integracion.adphor-platform.pages.dev';
const noStore={'Cache-Control':'no-store, private','Content-Type':'application/json; charset=utf-8',
  'X-Content-Type-Options':'nosniff','Vary':'Origin'};
function response(status,body,origin){
  const headers={...noStore,...(origin===QA_ORIGIN?{
    'Access-Control-Allow-Origin':QA_ORIGIN,
    'Access-Control-Allow-Headers':'authorization, apikey, content-type',
    'Access-Control-Allow-Methods':'GET, OPTIONS'}:{})};
  return new Response(status===204?null:JSON.stringify(body),{status,headers});
}
function payloadFromVerifiedJwt(token){
  try{const part=token.split('.')[1];if(!part)return null;
    return JSON.parse(atob(part.replace(/-/g,'+').replace(/_/g,'/')));
  }catch{return null;}
}
Deno.serve(async req=>{
  const origin=req.headers.get('origin');
  if(req.method==='OPTIONS')return response(origin===QA_ORIGIN?204:403,{},origin);
  if(req.method!=='GET')return response(405,{error:'READ_ONLY'},origin);
  if(origin && origin!==QA_ORIGIN)return response(403,{error:'ORIGIN_NOT_ALLOWED'},origin);
  const configured=Deno.env.get('SUPABASE_URL');
  const key=Deno.env.get('SUPABASE_ANON_KEY');
  if(configured!==QA_URL || !key)return response(503,{error:'QA_CONFIGURATION_REQUIRED'},origin);
  const authorization=req.headers.get('authorization')||'';
  const match=/^Bearer ([^\s]+)$/.exec(authorization);
  if(!match)return response(401,{error:'SESSION_REQUIRED'},origin);
  const client=createClient(QA_URL,key,{
    global:{headers:{Authorization:authorization}},
    auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
  });
  const {data:auth,error:authError}=await client.auth.getUser(match[1]);
  if(authError||!auth?.user)return response(401,{error:'INVALID_SESSION'},origin);
  if(auth.user.email?.toLowerCase()!=='riano200612@gmail.com')
    return response(403,{error:'OWNER_ONLY_QA'},origin);
  // Claims are inspected ONLY after getUser has verified the exact token.
  const claims=payloadFromVerifiedJwt(match[1]);
  if(claims?.sub!==auth.user.id || claims?.aal!=='aal2' || claims?.is_anonymous===true)
    return response(403,{error:'MFA_AAL2_REQUIRED'},origin);
  const {data:memberships,error:memberError}=await client.from('memberships')
    .select('project_id,role').eq('user_id',auth.user.id).eq('role','admin').limit(100);
  if(memberError)return response(403,{error:'AUTHORIZATION_UNAVAILABLE'},origin);
  if(!memberships?.length)return response(403,{error:'ADMIN_MEMBERSHIP_REQUIRED'},origin);
  const ids=[...new Set(memberships.map(m=>m.project_id))];
  const {data:projects,error:projectsError}=await client.from('projects')
    .select('id,name').in('id',ids).order('name',{ascending:true}).limit(100);
  if(projectsError)return response(403,{error:'CATALOG_UNAVAILABLE'},origin);
  const authorized=new Set(ids);
  const names=(projects||[]).filter(p=>authorized.has(p.id)&&typeof p.name==='string')
    .map(p=>p.name);
  // Absent historical tables must NEVER be reported as zero synchronized records.
  return response(200,{mode:'read_only_verified_real_data',source:'supabase_qa_projects',
    data:{property_rows:names.length,reconciled_properties:names.length,properties:names,
      meeting_evidence_rows:null,pqrs_evidence_rows:null,candidate_meetings:null,
      integration_status:{properties:'QA_AUTHORIZED_SQL',meetings:'NOT_INTEGRATED',
      visits:'NOT_INTEGRATED',pqrs:'NOT_INTEGRATED',personnel:'NOT_INTEGRATED'}},
    writes_enabled:false,historical_imported:false},origin);
});
