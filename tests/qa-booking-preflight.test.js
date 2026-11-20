import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeQaBookingIntent,assertQaBookingActor,assertQaBookingTestTarget,
 qaBookingAvailabilityWindow,qaBookingFingerprint,preflightQaBooking} from '../src/js/services/qa-booking-preflight.js';

const project='a1b2c3d4-0000-4000-8000-000000000001';
const actorId='a1b2c3d4-0000-4000-8000-000000000002';
const req='a1b2c3d4-0000-4000-8000-000000000003';
const now=Date.parse('2026-11-20T10:00:00-05:00');
const input={project_id:project,request_id:req,subject:'Consejo ADPHOR de prueba',
 modality:'Virtual',start:'2026-11-23T09:00:00-05:00',end:'2026-11-23T10:00:00-05:00'};
const actor={source:'supabase_server_verified',user_id:actorId,project_id:project,
 role:'coordinator',aal:'aal2',active:true};
const target={mode:'isolated_test',writeEnabled:false,
 testCalendarId:'c_qa_test@group.calendar.google.com',
 sourceCalendarId:'c_reuniones_source@group.calendar.google.com'};
const readBusy=async()=>({source:'google_freebusy',project_id:project,
 timezone:'America/Bogota',busy:[]});
const run=(overrides={})=>preflightQaBooking({input,actor,target,readBusy,now,...overrides});

test('no network write is exposed: eligible request remains non-bookable',async()=>{
 const calls=[];
 const result=await run({readBusy:async arg=>{calls.push(arg);return readBusy();}});
 assert.equal(result.status,'QA_TEST_PREFLIGHT_ONLY');
 assert.equal(result.booking_authorized,false);
 assert.equal(result.event_created,false);
 assert.equal(result.invites_sent,false);
 assert.equal(result.meet_created,false);
 assert.match(result.fingerprint,/^[0-9a-f]{64}$/);
 assert.equal(calls.length,1);
 assert.deepEqual(calls[0],{calendar_id:target.testCalendarId,project_id:project,
 start:'2026-11-23T13:30:00.000Z',end:'2026-11-23T15:30:00.000Z'});
});

test('untrusted form data, times, ambiguous offset and past times are rejected',()=>{
 for(const bad of [{...input,role:'admin'}, {...input,request_id:'bad'},
  {...input,subject:'Bad\nline'}, {...input,subject:'x'}, {...input,modality:'Hybrid'},
  {...input,start:'2026-11-23T09:00:00Z'},
  {...input,start:'2026-11-23T09:00:00'},
  {...input,end:input.start},
  {...input,end:'2026-11-24T10:00:00-05:00'},
  {...input,start:'2026-11-20T12:00:00-05:00'},
  {...input,start:'2027-04-23T12:00:00-05:00'}])
  assert.throws(()=>normalizeQaBookingIntent(bad,{now}));
});

test('AAL2, matching tenant, active verified server role are mandatory',async()=>{
 for(const bad of [{...actor,aal:'aal1'},{...actor,active:false},
  {...actor,role:'viewer'},{...actor,project_id:'other'},
  {...actor,source:'client'},{...actor,user_id:null}]){
  assert.throws(()=>assertQaBookingActor(bad,input),/QA_BOOKING_UNAUTHORIZED/);
  await assert.rejects(run({actor:bad}),/QA_BOOKING_UNAUTHORIZED/);
 }
});

test('the only accepted target is a separate QA test calendar with writes OFF',async()=>{
 for(const bad of [{...target,testCalendarId:target.sourceCalendarId},
  {...target,mode:'corporate'}, {...target,writeEnabled:true},
  {...target,sourceCalendarId:''},{...target,testCalendarId:'plataforma@adphor.com'}]){
  assert.throws(()=>assertQaBookingTestTarget(bad),/QA_BOOKING_TEST_TARGET_REQUIRED/);
  await assert.rejects(run({target:bad}),/QA_BOOKING_TEST_TARGET_REQUIRED/);
 }
});

test('unknown provider responses fail closed; no provider means no time certified',async()=>{
 await assert.rejects(run({readBusy:null}),/QA_BOOKING_PROVIDER_MISSING/);
 for(const response of [null,{}, {source:'local_demo',timezone:'America/Bogota',project_id:project,busy:[]},
  {source:'google_freebusy',timezone:'America/Bogota',project_id:'other',busy:[]},
  {source:'google_freebusy',timezone:'America/Bogota',project_id:project,busy:[null]}]){
  await assert.rejects(run({readBusy:async()=>response}),/QA_BOOKING_PROVIDER_UNVERIFIED/);
 }
 await assert.rejects(run({readBusy:async()=>{throw Error('oauth failed');}}),/QA_BOOKING_PROVIDER_UNVERIFIED/);
});

test('overlapping meetings and 30-minute buffers block the request',async()=>{
 for(const busy of [
  [{start:'2026-11-23T09:30:00-05:00',end:'2026-11-23T09:45:00-05:00'}],
  [{start:'2026-11-23T08:45:00-05:00',end:'2026-11-23T08:50:00-05:00'}],
  [{start:'2026-11-23T10:10:00-05:00',end:'2026-11-23T10:20:00-05:00'}]
 ])await assert.rejects(run({readBusy:async()=>({...await readBusy(),busy})}),/QA_BOOKING_SLOT_OCCUPIED/);
});

test('fingerprint is stable on repeat but changes with tenant, actor and details',async()=>{
 const intent=normalizeQaBookingIntent(input,{now});
 const original=await qaBookingFingerprint(intent,actor);
 assert.equal(original,await qaBookingFingerprint(intent,actor));
 assert.notEqual(original,await qaBookingFingerprint({...intent,subject:'Otra reunión'},actor));
 const another={...actor,user_id:'a1b2c3d4-0000-4000-8000-000000000004'};
 assert.notEqual(original,await qaBookingFingerprint(intent,another));
 assert.deepEqual(qaBookingAvailabilityWindow(intent),{start:'2026-11-23T13:30:00.000Z',end:'2026-11-23T15:30:00.000Z'});
});
