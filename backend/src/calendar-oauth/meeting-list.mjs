import {QA_URL} from '../../../qa/security/private-worker-bootstrap-core.mjs';

export const listMeetingsPath='/api/integrations/google-calendar/meetings/list';

function deny(status){return new Response(null,{status,headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'}});}

export function createCalendarMeetingList({verifyAccess,verifySession,lookupRole,meetingStore,pilotProjectId}){
  if(typeof verifyAccess!=='function'||typeof verifySession!=='function'||typeof lookupRole!=='function'||
    typeof meetingStore?.list!=='function'||typeof pilotProjectId!=='string')throw new Error('Calendar meeting list is not configured.');
  return async function handle(request){
    const url=new URL(request.url);
    if(url.origin!==QA_URL||url.pathname!==listMeetingsPath)return deny(404);
    if(request.method!=='POST')return deny(405);
    if(request.body!==null)return deny(400);
    if(request.headers.get('Origin')!==QA_URL)return deny(403);
    const projects=url.searchParams.getAll('project');
    if(projects.length!==1||[...url.searchParams].length!==1||projects[0]!==pilotProjectId)return deny(403);
    const bearer=/^Bearer ([A-Za-z0-9._-]{1,8192})$/.exec(request.headers.get('Authorization')||'')?.[1];
    if(!bearer)return deny(401);
    try{
      const access=await verifyAccess(request);
      if(!access?.subject)return deny(403);
      const session=await verifySession(bearer);
      if(!session?.userId)return deny(401);
      if(session.aal!=='aal2')return deny(403);
      const role=await lookupRole({bearer,userId:session.userId,projectId:pilotProjectId});
      if(role!=='admin'&&role!=='coordinator')return deny(403);
      const meetings=await meetingStore.list({actor:{userId:session.userId,projectId:pilotProjectId}});
      return Response.json({projectId:pilotProjectId,meetings},{headers:{
        'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff',
      }});
    }catch{return deny(503);}
  };
}
