const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_EVENTS_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
const encoder = new TextEncoder();

function validActor(actor) {
  return typeof actor?.userId === 'string' && actor.userId.length > 0 && actor.userId.length <= 255 &&
    typeof actor?.projectId === 'string' && /^[a-z0-9][a-z0-9-]{0,99}$/.test(actor.projectId);
}
function validRequest(input) {
  const dateTime = value => typeof value === 'string' &&
    /^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d{1,3})?)?(?:Z|[+-]\d\d:\d\d)$/.test(value) &&
    Number.isFinite(Date.parse(value));
  return typeof input?.summary === 'string' && input.summary.startsWith('[ADPHOR QA] ') &&
    input.summary.trim().length >= 15 && input.summary.trim().length <= 200 &&
    typeof input?.description === 'string' && input.description.length <= 5000 &&
    dateTime(input?.start) && dateTime(input?.end) && Date.parse(input.end)>Date.parse(input.start) &&
    Date.parse(input.end)-Date.parse(input.start)<=12*60*60*1000 &&
    (input.timeZone===undefined||(typeof input.timeZone==='string'&&input.timeZone.length<=64)) &&
    input.attendees===undefined;
}
function safeEvent(event) {
  const id=event?.id;
  const meet=event?.hangoutLink??event?.conferenceData?.entryPoints?.find(entry=>entry?.entryPointType==='video')?.uri;
  if(typeof id!=='string'||!/^[0-9a-v]{5,1024}$/.test(id))throw new Error('Google Calendar returned an invalid event.');
  const meetUrl=typeof meet==='string'?new URL(meet):null;
  const meetLink=meetUrl?.protocol==='https:'&&meetUrl.hostname==='meet.google.com'?meetUrl.href:null;
  const conferenceStatus=event?.conferenceData?.createRequest?.status?.statusCode;
  return {googleEventId:id,meetLink:conferenceStatus==='success'?meetLink:null,
    status:conferenceStatus==='success'&&meetLink?'created':'meet_pending'};
}
async function stableIdempotencyKey(actor,meeting) {
  const material=JSON.stringify(['ADPHOR-CALENDAR-BOOKING-V1',actor.userId,actor.projectId,
    meeting.summary.trim(),meeting.description,meeting.start,meeting.end,meeting.timeZone??'America/Bogota']);
  const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(material)));
  return [...digest].map(byte=>byte.toString(16).padStart(2,'0')).join('');
}
async function googleEventIdFor(idempotencyKey) {
  // RFC 4122 name-based UUID v5, encoded as 32 hex characters (valid base32hex).
  const namespace=Uint8Array.from('6ba7b8109dad11d180b400c04fd430c8'.match(/../g),part=>parseInt(part,16));
  const name=encoder.encode('ADPHOR-GOOGLE-EVENT-V1:'+idempotencyKey);
  const input=new Uint8Array(namespace.length+name.length);input.set(namespace);input.set(name,namespace.length);
  const digest=new Uint8Array(await crypto.subtle.digest('SHA-1',input));
  const uuid=digest.slice(0,16);uuid[6]=(uuid[6]&0x0f)|0x50;uuid[8]=(uuid[8]&0x3f)|0x80;
  return [...uuid].map(byte=>byte.toString(16).padStart(2,'0')).join('');
}
async function idForMeetRequest(actor,value) {
  const material=JSON.stringify(['ADPHOR-CALENDAR-QA',actor.userId,actor.projectId,value]);
  const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(material)));
  return [...digest].map(byte=>byte.toString(16).padStart(2,'0')).join('');
}
export function createGoogleCalendarEventService({clientId,clientSecret,getConnection,eventStore,transport=fetch}) {
  if(![clientId,clientSecret].every(value=>typeof value==='string'&&value.length>0)||
     typeof getConnection!=='function'||typeof eventStore?.claim!=='function'||
     typeof eventStore?.markAttempted!=='function'||typeof eventStore?.complete!=='function'||
     typeof eventStore?.fail!=='function'||typeof eventStore?.failDefinitively!=='function'||typeof eventStore?.claimMeetRefresh!=='function')
    throw new Error('Google Calendar event service is not configured.');
  async function request(url,options) {
    const response=await transport(url,{...options,redirect:'manual',cache:'no-store',signal:AbortSignal.timeout(8000)});
    if(!response.ok){const error=new Error('Google Calendar request failed.');error.status=response.status;throw error;}
    return response.json();
  }
  async function eventById(token,eventId) {
    const response=await transport(GOOGLE_EVENTS_URL+'/'+encodeURIComponent(eventId),{
      headers:{Authorization:'Bearer '+token},redirect:'manual',cache:'no-store',signal:AbortSignal.timeout(8000),
    });
    if(response.status===404)return null;
    if(!response.ok)throw new Error('Google Calendar event lookup failed.');
    return response.json();
  }
  async function accessToken(actor) {
    const connection=await getConnection(actor);
    if(typeof connection?.refreshToken!=='string'||!connection.refreshToken)throw new Error('Google Calendar connection is unavailable.');
    const token=await request(GOOGLE_TOKEN_URL,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
      body:new URLSearchParams({client_id:clientId,client_secret:clientSecret,refresh_token:connection.refreshToken,grant_type:'refresh_token'})});
    if(typeof token?.access_token!=='string'||!token.access_token||token.access_token.length>8192||
       token.token_type?.toLowerCase()!=='bearer')throw new Error('Google Calendar authorization is unavailable.');
    return token.access_token;
  }
  function persistedEvent(actor,idempotencyKey,meeting,remote) {
    const result=safeEvent(remote);
    return {...result,userId:actor.userId,projectId:actor.projectId,idempotencyKey,
      summary:meeting.summary.trim(),start:meeting.start,end:meeting.end};
  }
  function reconciliationEvent(actor,idempotencyKey,meeting,eventId) {
    return {userId:actor.userId,projectId:actor.projectId,idempotencyKey,googleEventId:eventId,
      meetLink:null,status:'reconciling',summary:meeting.summary.trim(),start:meeting.start,end:meeting.end};
  }
  async function createMeeting({actor,meeting}) {
    if(!validActor(actor)||!validRequest(meeting))throw new Error('Invalid Google Calendar meeting request.');
    const idempotencyKey=await stableIdempotencyKey(actor,meeting);
    const claim=await eventStore.claim({actor,idempotencyKey});
    if(claim?.status==='complete')return claim.event;
    if(claim?.status==='rejected')return {...claim.event,googleEventId:null,meetLink:null,status:'failed'};
    if(claim?.status!=='claimed')throw new Error('Google Calendar request is already in progress.');
    const previousAttempt=typeof claim.googleEventId==='string'&&claim.googleEventId.length>0;
    let intentDurable=false,eventId=claim.googleEventId;
    try{
      const token=await accessToken(actor);
      eventId=eventId||await googleEventIdFor(idempotencyKey);
      await eventStore.markAttempted({actor,idempotencyKey,googleEventId:eventId,
        summary:meeting.summary.trim(),start:meeting.start,end:meeting.end});
      intentDurable=true;
      let remote;
      if(previousAttempt){
        // An earlier insert may have succeeded even if a prior GET is still empty.
        // Reconcile by the stored ID only; never issue a second POST automatically.
        remote=await eventById(token,eventId);
        if(!remote)return reconciliationEvent(actor,idempotencyKey,meeting,eventId);
      }else{
        const providerRequestId=await idForMeetRequest(actor,idempotencyKey);
        const body={id:eventId,summary:meeting.summary.trim(),description:meeting.description,
          start:{dateTime:meeting.start,timeZone:meeting.timeZone??'America/Bogota'},
          end:{dateTime:meeting.end,timeZone:meeting.timeZone??'America/Bogota'},visibility:'private',
          extendedProperties:{private:{adphorRequestId:providerRequestId}},
          conferenceData:{createRequest:{requestId:providerRequestId,conferenceSolutionKey:{type:'hangoutsMeet'}}}};
        try{
          remote=await request(GOOGLE_EVENTS_URL+'?conferenceDataVersion=1&sendUpdates=none',{
            method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body)});
        }catch(error){
          if([400,401,403,404,410,422].includes(error?.status)){
            try{await eventStore.failDefinitively({actor,idempotencyKey,googleEventId:eventId});
              return {...reconciliationEvent(actor,idempotencyKey,meeting,eventId),googleEventId:null,status:'failed'};
            }catch{return reconciliationEvent(actor,idempotencyKey,meeting,eventId);}
          }
          if(error?.status!==409)return reconciliationEvent(actor,idempotencyKey,meeting,eventId);
          remote=await eventById(token,eventId);
          if(!remote)return reconciliationEvent(actor,idempotencyKey,meeting,eventId);
        }
      }
      const result=persistedEvent(actor,idempotencyKey,meeting,remote);
      if(result.googleEventId!==eventId)throw new Error('Google Calendar event identity did not match the booking.');
      await eventStore.complete({actor,event:result});
      return result;
    }catch(error){
      if(intentDurable)return reconciliationEvent(actor,idempotencyKey,meeting,eventId);
      try{await eventStore.fail({actor,idempotencyKey});}catch{}
      throw error;
    }
  }
  async function refreshMeeting({actor,idempotencyKey}) {
    if(!validActor(actor)||typeof idempotencyKey!=='string'||!/^([a-f0-9]{64})$/.test(idempotencyKey))
      throw new Error('Invalid Google Calendar meeting reference.');
    const claim=await eventStore.claimMeetRefresh({actor,idempotencyKey});
    if(claim?.status==='complete'||claim?.status==='cooldown')return claim.event;
    if(claim?.status!=='claimed'||!claim.event?.googleEventId)throw new Error('Google Calendar meeting is unavailable.');
    const token=await accessToken(actor);
    const remote=await eventById(token,claim.event.googleEventId);
    if(!remote)return {...claim.event,status:'reconciling',meetLink:null};
    const result=safeEvent(remote);
    if(result.googleEventId!==claim.event.googleEventId)throw new Error('Google Calendar event identity did not match the saved meeting.');
    const updated={...claim.event,...result};
    await eventStore.complete({actor,event:updated});
    return updated;
  }
  return {createMeeting,refreshMeeting};
}
