import {QA_URL} from '../../../qa/security/private-worker-bootstrap-core.mjs';

export const createMeetingPath = '/api/integrations/google-calendar/meetings/create';

function deny(status) {
  return new Response(null, {status, headers: {
    'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
  }});
}

async function readRequest(request) {
  const length=Number(request.headers.get('Content-Length') || 0);
  if (length > 16000) return null;
  const text=await request.text();
  if (text.length > 16000) return null;
  try {
    const value=JSON.parse(text);
    return value && typeof value==='object' && !Array.isArray(value) ? value : null;
  } catch { return null; }
}

// The route checks every identity boundary before calling Google. A client
// cannot choose a different pilot project, inject guests or book without a
// separate explicit confirmation.
export function createCalendarMeetingCreate({verifyAccess,verifySession,lookupRole,createMeeting,pilotProjectId}) {
  if (typeof verifyAccess!=='function' || typeof verifySession!=='function' ||
      typeof lookupRole!=='function' || typeof createMeeting!=='function' ||
      typeof pilotProjectId!=='string' || !/^[a-z0-9][a-z0-9-]{0,99}$/.test(pilotProjectId)) {
    throw new Error('Calendar meeting route is not configured.');
  }
  return async function handle(request) {
    const url=new URL(request.url);
    if(url.origin!==QA_URL || url.pathname!==createMeetingPath)return deny(404);
    if(request.method!=='POST')return deny(405);
    if(request.headers.get('Origin')!==QA_URL)return deny(403);
    const projects=url.searchParams.getAll('project');
    if(projects.length!==1 || [...url.searchParams].length!==1 || projects[0]!==pilotProjectId)return deny(403);
    const bearer=/^Bearer ([A-Za-z0-9._-]{1,8192})$/.exec(request.headers.get('Authorization')||'')?.[1];
    if(!bearer)return deny(401);
    const payload=await readRequest(request);
    if(!payload || payload.confirmed!==true || payload.attendees!==undefined ||
      Object.keys(payload).some(key=>!['confirmed','idempotencyKey','summary','description','start','end','timeZone'].includes(key)))return deny(400);
    try{
      const access=await verifyAccess(request);
      if(!access?.subject)return deny(403);
      const session=await verifySession(bearer);
      if(!session?.userId)return deny(401);
      if(session.aal!=='aal2')return deny(403);
      const role=await lookupRole({bearer,userId:session.userId,projectId:pilotProjectId});
      if(role!=='admin' && role!=='coordinator')return deny(403);
      const event=await createMeeting({
        actor:{userId:session.userId,projectId:pilotProjectId},
        meeting:{
          idempotencyKey:payload.idempotencyKey,summary:payload.summary,
          description:payload.description,start:payload.start,end:payload.end,timeZone:payload.timeZone,
        },
      });
      if(!event || !['created','meet_pending'].includes(event.status))return deny(503);
      return Response.json(event,{status:event.status==='created'?201:202,headers:{
        'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff',
      }});
    }catch{return deny(503);}
  };
}
