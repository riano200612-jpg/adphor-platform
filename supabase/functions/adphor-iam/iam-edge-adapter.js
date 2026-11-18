import {createIamQaHandler} from './iam-api-gate.js';
const QA_ORIGIN='https://qa-integral-claude-reviewed.adphor-platform.pages.dev';
const EDGE_ORIGIN='https://qfctnnnnltghepwujpdm.supabase.co';
const HEADERS={'Cache-Control':'no-store, max-age=0','Content-Type':'application/json','X-Content-Type-Options':'nosniff'};
const denied=(status)=>new Response(JSON.stringify({error:'Acceso no autorizado o servicio no disponible.'}),{status,headers:HEADERS});
export function createIamEdgeAdapter(createClient){
 const handler=createIamQaHandler(createClient);
 return async (request,secrets={})=>{
  const u=new URL(request.url);
  if(u.origin!==EDGE_ORIGIN||u.pathname!=='/functions/v1/adphor-iam'||u.search)return denied(404);
  if(!['GET','POST'].includes(request.method))return denied(405);
  // Operaciones del panel no están disponibles directamente desde el navegador,
  // que debe atravesar el hostname protegido por Cloudflare Access.
  if(request.headers.get('Origin')!==QA_ORIGIN)return denied(403);
  if(secrets.QA_REF!=='qfctnnnnltghepwujpdm'||
     !secrets.SUPABASE_SERVICE_ROLE_KEY)return denied(503);
  let rewritten;
  try{rewritten=new Request(QA_ORIGIN+'/api/iam',request);}
  catch{return denied(400);}
  return handler({request:rewritten,env:{
    ADPHOR_QA_IAM_ENABLED:'true',
    ADPHOR_QA_IAM_REF:'qfctnnnnltghepwujpdm',
    SUPABASE_SERVICE_ROLE_KEY:secrets.SUPABASE_SERVICE_ROLE_KEY
  }});
 };
}
