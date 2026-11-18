// ADPHOR QA Integral IAM: proxy sin secretos privilegiados de Supabase.
// La ejecución real vive en una Supabase Edge Function protegida por JWT AAL2.
const ORIGIN='https://qa-integral-claude-reviewed.adphor-platform.pages.dev';
const SUPABASE='https://qfctnnnnltghepwujpdm.supabase.co';
const EDGE_URL=SUPABASE+'/functions/v1/adphor-iam';
const H={'Content-Type':'application/json; charset=utf-8',
  'Cache-Control':'no-store, max-age=0','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'};
const response=(status,error='No fue posible atender la solicitud.')=>new Response(JSON.stringify({error}),{status,headers:H});
export async function iamPagesProxy({request,env},transport=fetch){
 const url=new URL(request.url);
 if(url.origin!==ORIGIN||url.pathname!=='/api/iam'||url.search)return response(404,'Ruta no disponible.');
 if(!['GET','POST'].includes(request.method))return response(405,'Método no permitido.');
 if(request.method==='POST'&&request.headers.get('Origin')!==ORIGIN)return response(403,'Origen no autorizado.');
 if(request.headers.has('Origin')&&request.headers.get('Origin')!==ORIGIN)return response(403,'Origen no autorizado.');
 if(env?.ADPHOR_QA_IAM_PROXY_ENABLED!=='true'||
    env?.VITE_SUPABASE_URL!==SUPABASE ||
    !env?.VITE_SUPABASE_ANON_KEY)return response(503,'Usuarios y permisos: pendiente de activación segura.');
 const auth=request.headers.get('Authorization')||'';
 if(!/^Bearer [A-Za-z0-9._-]{40,5000}$/.test(auth))return response(401,'Sesión requerida.');
 let body;
 if(request.method==='POST'){
  const length=Number(request.headers.get('Content-Length')||0);
  if(length>12000)return response(413,'Solicitud demasiado extensa.');
  body=await request.text();
  if(body.length>12000)return response(413,'Solicitud demasiado extensa.');
 }
 try{
  const r=await transport(EDGE_URL,{method:request.method,
    headers:{'Authorization':auth,'apikey':env.VITE_SUPABASE_ANON_KEY,'Origin':ORIGIN,
      'Content-Type':'application/json','Accept':'application/json'},
    body,redirect:'error',cache:'no-store'});
  if(![200,201,202,400,401,403,405,409,413,503].includes(r.status))return response(502);
  if(!r.headers.get('Content-Type')?.toLowerCase().includes('application/json'))return response(502);
  const text=await r.text();
  if(text.length>262144)return response(502);
  let parsed;
  try{parsed=JSON.parse(text);}catch{return response(502);}
  if(parsed===null||typeof parsed!=='object'||Array.isArray(parsed))return response(502);
  return new Response(JSON.stringify(parsed),{status:r.status,headers:H});
 }catch{return response(503);}
}
