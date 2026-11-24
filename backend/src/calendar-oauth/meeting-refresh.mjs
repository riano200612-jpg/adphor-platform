import {QA_URL} from '../../../qa/security/private-worker-bootstrap-core.mjs';
export const refreshMeetingPath='/api/integrations/google-calendar/meetings/refresh';
function deny(status){return new Response(null,{status,headers:{
  'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff',
}});}
export function createCalendarMeetingRefresh({verifyAccess,verifySession,lookupRole,refreshMeeting,pilotProjectId}){
  if(typeof verifyAccess!=='function'||typeof verifySession!=='function'||typeof lookupRole!=='function'||
    typeof refreshMeeting!=='function'||typeof pilotProjectId!=='string'||
    !/^[a-z0-9][a-z0-9-]{0,99}$/.test(pilotProjectId))throw new Error('Calendar meeting refresh is not configured.');
  return async function handle(request){
    const url=new URL(request.url);
    if(url.origin!==QA_URL||url.pathname!==refreshMeetingPath)return deny(404);
    if(request.method!=='POST')return deny(405);
    if(request.headers.get('Origin')!==QA_URL)return deny(403);
    const projects=url.searchParams.getAll('project');
    if(projects.length!==1||[...url.searchParams].length!==1||projects[0]!==pilotProjectId)return deny(403);
    const bearer=/^Bearer ([A-Za-z0-9._-]{1,8192})$/.exec(request.headers.get('Authorization')||'')?.[1];
    if(!bearer)return deny(401);
    let payload;
    try{
      const length=Number(request.headers.get('Content-Length')||0);if(length>2048)return deny(400);
      const text=await request.text();if(new TextEncoder().encode(text).byteLength>2048)return deny(400);
      payload=JSON.parse(text);
    }catch{return deny(400);}
    if(!payload||typeof payload!=='object'||Array.isArray(payload)||
      Object.keys(payload).some(key=>key!=='idempotencyKey')||
      typeof payload.idempotencyKey!=='string'||! /^[a-f0-9]{64}$/.test(payload.idempotencyKey))return deny(400);
    try{
      const access=await verifyAccess(request);if(!access?.subject)return deny(403);
      const session=await verifySession(bearer);if(!session?.userId)return deny(401);
      if(session.aal!=='aal2')return deny(403);
      const role=await lookupRole({bearer,userId:session.userId,projectId:pilotProjectId});
      if(role!=='admin'&&role!=='coordinator')return deny(403);
      const event=await refreshMeeting({actor:{userId:session.userId,projectId:pilotProjectId},idempotencyKey:payload.idempotencyKey});
      if(!event||!['created','meet_pending'].includes(event.status)||!event.googleEventId)return deny(503);
      return Response.json(event,{status:event.status==='created'?200:202,headers:{
        'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff',
      }});
    }catch{return deny(503);}
  };
}
