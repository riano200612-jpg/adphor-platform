import assert from 'node:assert/strict';
import test from 'node:test';
import {createGoogleCalendarEventService} from '../backend/src/calendar-oauth/google-calendar-events.mjs';
const actor={userId:'qa-user',projectId:'source-28'};
const meeting={summary:'[ADPHOR QA] Reunión piloto ADPHOR',description:'Evento de prueba privado.',
 start:'2026-12-01T10:00:00-05:00',end:'2026-12-01T10:30:00-05:00',timeZone:'America/Bogota'};
function setup({failInsertResponse=false,failPersistOnce=false,pendingMeet=false}={}){
 const remote=new Map(),calls=[],state={locked:false,eventId:null,persisted:null,persistFail:failPersistOnce};
 const store={
  async claim(){if(state.persisted)return {status:'complete',event:state.persisted};if(state.locked)return {status:'in_progress'};state.locked=true;return {status:'claimed',googleEventId:state.eventId};},
  async markAttempted(v){if(state.eventId&&state.eventId!==v.googleEventId)throw Error('id changed');state.eventId=v.googleEventId;},
  async complete({event}){if(state.persistFail){state.persistFail=false;throw Error('synthetic persistence failure');}state.persisted=event;state.locked=false;},
  async fail(){state.locked=false;if(!state.eventId)state.persisted=null;},
  async claimMeetRefresh(){return state.persisted?.status==='created'?{status:'complete',event:state.persisted}:{status:'claimed',event:state.persisted};},
 };
 const service=createGoogleCalendarEventService({clientId:'fixture',clientSecret:'fixture',getConnection:async()=>({refreshToken:'refresh'}),eventStore:store,
  async transport(url,options={}){
   calls.push({url:String(url),options});
   if(url==='https://oauth2.googleapis.com/token')return Response.json({access_token:'access',token_type:'Bearer'});
   const u=new URL(url),path='/calendar/v3/calendars/primary/events';
   if(u.pathname.startsWith(path+'/')){const id=decodeURIComponent(u.pathname.split('/').pop());return remote.has(id)?Response.json(remote.get(id)):Response.json({}, {status:404});}
   if(u.pathname===path&&options.method==='POST'){
    const body=JSON.parse(options.body);assert.match(body.id,/^[0-9a-f]{32}$/);assert.equal(body.attendees,undefined);
    assert.equal(body.visibility,'private');assert.equal(u.searchParams.get('conferenceDataVersion'),'1');assert.equal(u.searchParams.get('sendUpdates'),'none');
    if(remote.has(body.id))return Response.json({}, {status:409});
    const event={id:body.id};if(!pendingMeet)event.conferenceData={createRequest:{status:{statusCode:'success'}},entryPoints:[{entryPointType:'video',uri:'https://meet.google.com/abc-defg-hij'}]};
    remote.set(body.id,event);if(failInsertResponse){failInsertResponse=false;throw Error('synthetic timeout after accept');}return Response.json(event);
   }
   return Response.json({}, {status:500});
  }});
 return {service,remote,calls,state};
}
const insertCount=calls=>calls.filter(c=>c.options.method==='POST'&&c.url.includes('/events?')).length;

test('creates one private event using a deterministic Google ID and confirmed Meet',async()=>{
 const {service,calls,state}=setup();const result=await service.createMeeting({actor,meeting});
 assert.equal(result.status,'created');assert.match(result.googleEventId,/^[0-9a-f]{32}$/);
 assert.equal(result.meetLink,'https://meet.google.com/abc-defg-hij');assert.equal(state.persisted.googleEventId,result.googleEventId);
 assert.equal(insertCount(calls),1);assert.deepEqual(await service.createMeeting({actor,meeting}),result);
});
test('recovers accepted event after timeout by exact ID and does not insert again',async()=>{
 const {service,calls,state}=setup({failInsertResponse:true});await assert.rejects(service.createMeeting({actor,meeting}));
 const original=state.eventId;state.locked=false;
 const result=await service.createMeeting({actor,meeting});assert.equal(result.googleEventId,original);assert.equal(result.status,'created');
 assert.equal(insertCount(calls),1);
});
test('persistence failure after Google acceptance preserves intent and reconciles without duplicate',async()=>{
 const {service,calls,state}=setup({failPersistOnce:true});await assert.rejects(service.createMeeting({actor,meeting}),/synthetic persistence failure/);
 assert.ok(state.eventId);state.locked=false;
 const result=await service.createMeeting({actor,meeting});assert.equal(result.googleEventId,state.eventId);
 assert.equal(insertCount(calls),1);
});
test('temporary exact-ID 404 and a retry reuse the same ID; a duplicate response reconciles by ID',async()=>{
 const remote=new Map(),ids=[],state={eventId:null,locked:false,persisted:null};let posts=0,lookups=0;
 const svc=createGoogleCalendarEventService({clientId:'c',clientSecret:'s',getConnection:async()=>({refreshToken:'r'}),
 eventStore:{async claim(){if(state.persisted)return {status:'complete',event:state.persisted};if(state.locked)return {status:'in_progress'};state.locked=true;return {status:'claimed',googleEventId:state.eventId};},
 async markAttempted(v){state.eventId=v.googleEventId;},async complete({event}){state.persisted=event;state.locked=false;},async fail(){state.locked=false;},
 async claimMeetRefresh(){return {status:'missing'};}},
 async transport(url,options={}){if(url==='https://oauth2.googleapis.com/token')return Response.json({access_token:'a',token_type:'Bearer'});
 const u=new URL(url),path='/calendar/v3/calendars/primary/events';
 if(u.pathname.startsWith(path+'/')){lookups++;if(lookups===2)return Response.json({}, {status:404});const id=u.pathname.split('/').pop();return remote.has(id)?Response.json(remote.get(id)):Response.json({}, {status:404});}
 if(u.pathname===path&&options.method==='POST'){posts++;const body=JSON.parse(options.body);ids.push(body.id);
  if(remote.has(body.id))return Response.json({}, {status:409});
  const event={id:body.id,conferenceData:{createRequest:{status:{statusCode:'success'}},entryPoints:[{entryPointType:'video',uri:'https://meet.google.com/abc-defg-hij'}]}};
  remote.set(body.id,event);if(posts===1)throw Error('timeout');return Response.json(event);}
 return Response.json({}, {status:500});}});
 await assert.rejects(svc.createMeeting({actor,meeting}));state.locked=false;
 const result=await svc.createMeeting({actor,meeting});assert.equal(result.status,'created');
 assert.equal(posts,2);assert.equal(ids[0],ids[1]);assert.equal(result.googleEventId,ids[0]);
});
test('concurrent confirmations cannot both claim and insert',async()=>{
 const remote=new Map(),state={locked:false,persisted:null,eventId:null};let release,notifyPost,posts=0;
 const waiting=new Promise(resolve=>release=resolve),started=new Promise(resolve=>notifyPost=resolve);
 const svc=createGoogleCalendarEventService({clientId:'c',clientSecret:'s',getConnection:async()=>({refreshToken:'r'}),
 eventStore:{async claim(){if(state.persisted)return {status:'complete',event:state.persisted};if(state.locked)return {status:'in_progress'};state.locked=true;return {status:'claimed',googleEventId:state.eventId};},
 async markAttempted(v){state.eventId=v.googleEventId;},async complete({event}){state.persisted=event;state.locked=false;},async fail(){state.locked=false;},
 async claimMeetRefresh(){return {status:'missing'};}},
 async transport(url,options={}){if(url==='https://oauth2.googleapis.com/token')return Response.json({access_token:'a',token_type:'Bearer'});
 const u=new URL(url),path='/calendar/v3/calendars/primary/events';
 if(u.pathname.startsWith(path+'/')){const id=u.pathname.split('/').pop();return remote.has(id)?Response.json(remote.get(id)):Response.json({}, {status:404});}
 if(u.pathname===path&&options.method==='POST'){posts++;notifyPost();const body=JSON.parse(options.body);await waiting;
 const event={id:body.id,conferenceData:{createRequest:{status:{statusCode:'success'}},entryPoints:[{entryPointType:'video',uri:'https://meet.google.com/abc-defg-hij'}]}};
 remote.set(event.id,event);release();return Response.json(event);}
 return Response.json({}, {status:500});}});
 const first=svc.createMeeting({actor,meeting});await started;
 await assert.rejects(svc.createMeeting({actor,meeting}),/in progress/);release();
 assert.equal((await first).status,'created');assert.equal(posts,1);
});
test('MEET_PENDING refresh reads the same event and never inserts a second event',async()=>{
 const {service,calls,remote}=setup({pendingMeet:true});const pending=await service.createMeeting({actor,meeting});assert.equal(pending.status,'meet_pending');
 remote.get(pending.googleEventId).conferenceData={createRequest:{status:{statusCode:'success'}},entryPoints:[{entryPointType:'video',uri:'https://meet.google.com/abc-defg-hij'}]};
 const checked=await service.refreshMeeting({actor,idempotencyKey:pending.idempotencyKey});
 assert.equal(checked.status,'created');assert.equal(checked.googleEventId,pending.googleEventId);
 assert.equal(checked.meetLink,'https://meet.google.com/abc-defg-hij');assert.equal(insertCount(calls),1);
});
