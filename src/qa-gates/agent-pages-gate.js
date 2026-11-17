// Pages same-origin QA gateway: no direct Worker URL, no credentials persisted.
const QA_HOST = 'qa-integral-claude-reviewed.adphor-platform.pages.dev';
const INTERNAL_ORIGIN = 'https://agent-readonly.internal';
const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const PROJECT = /^[A-Za-z0-9_-]{1,100}$/;
const HASH = /^[0-9a-f]{64}$/;
const STATUS = new Set([
  'Pendiente de aprobación del administrador',
  'Aprobado por el administrador',
  'Rechazado por el administrador',
]);
const HEADERS = Object.freeze({
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store, private, max-age=0',
  'Pragma': 'no-cache',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-ADPHOR-Agent-Mode': 'read-only',
});

function answer(status, message, body) {
  return new Response(JSON.stringify(body ?? {error:message}), {status,headers:HEADERS});
}

function parseRoute(url) {
  const path=url.pathname;
  const kind=path==='/agent-readiness'?'ready':path==='/agent-runs'?'list':
    path.startsWith('/agent-runs/')&&UUID.test(path.slice('/agent-runs/'.length))?'detail':null;
  if(!kind)return null;
  const permitted = kind==='list' ? new Set(['project_id','limit','offset']) : new Set(['project_id']);
  for(const key of url.searchParams.keys()) {
    if(!permitted.has(key)||url.searchParams.getAll(key).length!==1)return null;
  }
  const project=url.searchParams.get('project_id');
  if(!project||!PROJECT.test(project))return null;
  if(kind==='list') {
    const limit=url.searchParams.get('limit');
    const offset=url.searchParams.get('offset');
    if(limit!==null && limit!=='20')return null;
    if(offset!==null && (!/^(0|[1-9][0-9]{0,4})$/.test(offset)||Number(offset)>10000))return null;
  }
  return {kind,project,id:kind==='detail'?path.slice('/agent-runs/'.length):null};
}
function rowValid(item, project) {
  return item!==null&&typeof item==='object'&&item.project_id===project &&
    typeof item.id==='string'&&UUID.test(item.id) &&
    ['rules','models'].includes(item.engine_kind) &&
    STATUS.has(item.status) && typeof item.source_read_at==='string' &&
    Number.isFinite(Date.parse(item.source_read_at));
}
function validResponse(data, route) {
  if(!data||typeof data!=='object'||Array.isArray(data))return false;
  if(route.kind==='ready')return data.mode==='qa_rules_only' &&
    data.project_id===route.project && data.registry_ready===true &&
    data.rules_ready===false && data.reviews_ready===false && data.models_ready===false;
  if(route.kind==='list')return Array.isArray(data.items)&&data.items.length<=20 &&
    data.items.every(x=>rowValid(x,route.project));
  return rowValid(data,route.project) && data.id.toLowerCase()===route.id.toLowerCase() &&
    typeof data.draft==='string' && typeof data.result_hash==='string' &&
    HASH.test(data.result_hash);
}

export async function agentPagesReadOnlyGate(context) {
  const {request,env}=context;
  const url=new URL(request.url);
  if(url.protocol!=='https:'||url.hostname!==QA_HOST||url.port) {
    return answer(404,'La API no está disponible fuera de QA Integral.');
  }
  if(request.method!=='GET')return answer(405,'Operación deshabilitada: solo lectura.');
  const route=parseRoute(url);
  if(!route)return answer(400,'Ruta o parámetros del enjambre no válidos.');
  const from=request.headers.get('Origin');
  if(from && from!==url.origin)return answer(403,'Origen no permitido.');
  const bearer=request.headers.get('Authorization')??'';
  if(!/^Bearer [A-Za-z0-9._~-]{8,8192}$/.test(bearer)) {
    return answer(401,'Sesión de ADPHOR requerida.');
  }
  if(env?.ADPHOR_QA_AGENT_READONLY_PROXY_ENABLED!=='true' ||
     typeof env?.ADPHOR_AGENT_READONLY?.fetch!=='function') {
    return answer(503,'El servicio privado del enjambre no está habilitado.');
  }

  // Explicit allowlist: never forward cookies, client-supplied internal headers,
  // redirects, request body, access assertions or arbitrary HTTP methods.
  const internal=new URL(url.pathname+url.search,INTERNAL_ORIGIN);
  const upstreamReq=new Request(internal,{
    method:'GET',
    headers:{
      'Authorization':bearer,
      'Origin':url.origin,
      'Accept':'application/json',
      'Cache-Control':'no-store',
    },
    redirect:'error',
  });
  let response;
  try {
    response=await env.ADPHOR_AGENT_READONLY.fetch(upstreamReq);
  }catch{
    return answer(503,'El servicio privado del enjambre no respondió.');
  }
  if(response.status!==200) {
    const status=[400,401,403,404,405].includes(response.status)?response.status:503;
    return answer(status,'La consulta protegida no se pudo completar.');
  }
  const size=Number(response.headers.get('Content-Length')??0);
  if(!Number.isFinite(size)||size>256000)return answer(502,'Respuesta del servicio inválida.');
  if(!/^(application\/json)(\s*;|$)/i.test(response.headers.get('Content-Type')??'')) {
    return answer(502,'Respuesta del servicio inválida.');
  }
  let raw;
  try {raw=await response.text();} catch {return answer(502,'Respuesta del servicio inválida.');}
  if(raw.length>256000)return answer(502,'Respuesta del servicio inválida.');
  let data;
  try{data=JSON.parse(raw);}catch{return answer(502,'Respuesta del servicio inválida.');}
  if(!validResponse(data,route))return answer(502,'Respuesta del servicio inválida.');
  // Strip ALL upstream response headers and cache metadata.
  return answer(200,'',data);
}
