// ADPHOR QA only. Google freeBusy read-only: no event details or writes.
import {QA_PROJECT_URL, QA_FRONTEND, QA_SOURCE,
  validateAvailabilityBody, parseValidatedAal2, normalizeBusy} from './core.js';

const cors = {
  'Access-Control-Allow-Origin': QA_FRONTEND,
  'Access-Control-Allow-Headers': 'authorization, apikey, x-client-info, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '600',
  'Vary': 'Origin',
};
const baseHeaders = {'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const reply = (status: number, body: unknown, allowedOrigin: boolean) =>
  Response.json(body,{status,headers:{...baseHeaders,...(allowedOrigin?cors:{})}});

async function checkedFetch(url: string, init: RequestInit, timeout=8000): Promise<Response> {
  return fetch(url,{...init,redirect:'error',cache:'no-store',signal:AbortSignal.timeout(timeout)});
}

Deno.serve(async req => {
  const authorizedOrigin = req.headers.get('Origin') === QA_FRONTEND;
  if(!authorizedOrigin)return reply(403,{error:'Origen QA no autorizado.'},false);
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:{...baseHeaders,...cors}});
  if(req.method!=='POST')return reply(405,{error:'Método no permitido.'},true);
  if((req.headers.get('content-type')||'').split(';')[0].trim()!=='application/json')return reply(415,{error:'Solicitud JSON requerida.'},true);
  const bearer=req.headers.get('Authorization')||'';
  const match=/^Bearer ([A-Za-z0-9._-]+)$/.exec(bearer);
  if(!match||match[1].length>8192)return reply(401,{error:'Sesión QA requerida.'},true);

  let body;
  try{
    const bytes=await req.text();
    if(bytes.length>2048)throw Error('large');
    body=validateAvailabilityBody(JSON.parse(bytes));
  }catch{return reply(422,{error:'Copropiedad u horario no válido.'},true);}

  // No service-role key is ever used for authorization or RLS queries.
  const projectUrl=Deno.env.get('SUPABASE_URL')?.replace(/\/$/,'');
  const apiKey=Deno.env.get('SUPABASE_ANON_KEY');
  if(projectUrl!==QA_PROJECT_URL||!apiKey)return reply(503,{error:'Servicio QA no configurado.'},true);
  const authHeaders={'apikey':apiKey,'Authorization':bearer,'Accept':'application/json'};
  let userId: string;
  try {
    const response=await checkedFetch(`${QA_PROJECT_URL}/auth/v1/user`,{headers:authHeaders});
    if(response.status===401||response.status===403)return reply(401,{error:'Sesión expirada.'},true);
    if(!response.ok)throw Error('auth unavailable');
    const user=await response.json();
    if(typeof user?.id!=='string'||!parseValidatedAal2(match[1],user.id))return reply(403,{error:'Se requiere MFA AAL2.'},true);
    userId=user.id;
  }catch{return reply(503,{error:'No se pudo verificar la sesión QA.'},true);}

  // Current membership under the end-user JWT and RLS, including QA active
  // principal and AAL2 checks. No bypass via administrator credentials.
  try{
    const search=new URLSearchParams({select:'role',project_id:`eq.${body.project_id}`,user_id:`eq.${userId}`,limit:'2'});
    const response=await checkedFetch(`${QA_PROJECT_URL}/rest/v1/memberships?${search}`,{headers:authHeaders});
    if(response.status===401||response.status===403)return reply(403,{error:'Copropiedad no autorizada.'},true);
    if(!response.ok)throw Error('membership unavailable');
    const rows=await response.json();
    if(!Array.isArray(rows)||rows.length!==1||!['admin','coordinator'].includes(rows[0]?.role))return reply(403,{error:'Copropiedad no autorizada.'},true);
  }catch{return reply(503,{error:'No se pudo verificar la membresía QA.'},true);}

  const calendarId=Deno.env.get('ADPHOR_QA_CALENDAR_ID');
  const oauth={
    client_id:Deno.env.get('ADPHOR_QA_CALENDAR_OAUTH_CLIENT_ID'),
    client_secret:Deno.env.get('ADPHOR_QA_CALENDAR_OAUTH_CLIENT_SECRET'),
    refresh_token:Deno.env.get('ADPHOR_QA_CALENDAR_OAUTH_REFRESH_TOKEN'),
  };
  if(!calendarId||!Object.values(oauth).every(Boolean))return reply(503,{error:'Google Calendar corporativo no configurado en QA.'},true);
  try {
    const grant=await checkedFetch('https://oauth2.googleapis.com/token',{
      method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
      body:new URLSearchParams({...oauth,grant_type:'refresh_token'} as Record<string,string>).toString(),
    });
    if(!grant.ok)throw Error('oauth failed');
    const grantData=await grant.json();
    if(typeof grantData?.access_token!=='string'||!grantData.access_token)throw Error('oauth invalid');
    const data=await checkedFetch('https://www.googleapis.com/calendar/v3/freeBusy',{
      method:'POST',headers:{Authorization:`Bearer ${grantData.access_token}`,'Content-Type':'application/json'},
      body:JSON.stringify({timeMin:body.start,timeMax:body.end,timeZone:'America/Bogota',items:[{id:calendarId}]}),
    });
    if(!data.ok)throw Error('calendar failed');
    const busy=normalizeBusy(await data.json(),calendarId);
    return reply(200,{project_id:body.project_id,timezone:'America/Bogota',source:QA_SOURCE,busy},true);
  }catch{
    return reply(502,{error:'No se pudo verificar la disponibilidad corporativa. No se confirmó ningún horario.'},true);
  }
});
