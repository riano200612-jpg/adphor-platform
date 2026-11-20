// QA-only, backend-side planning contract. No Calendar writes, invites, Meet, SQL or OAuth.
// A caller MUST verify Supabase Auth, MFA AAL2 and RLS membership on the server.
import {calendarInstant,calendarHasConflict,validateCalendarAvailabilityResponse} from './calendar-availability.js';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const COLOMBIA=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?-05:00$/;
const GROUP_CALENDAR=/^[a-z0-9._+-]+@group\.calendar\.google\.com$/;
const HOUR=60*60*1000, BUFFER=30*60*1000;
const expectedKeys='end,modality,project_id,request_id,start,subject';
const allowedModes=new Set(['Presencial','Virtual','Mixta']);
const blocked=(code)=>{const error=new Error(code);error.code=code;throw error;};

export function normalizeQaBookingIntent(input,{now=Date.now()}={}){
 if(!input||typeof input!=='object'||Array.isArray(input)||
    Object.keys(input).sort().join(',')!==expectedKeys)blocked('QA_BOOKING_BAD_FIELDS');
 if(!UUID.test(input.project_id)||!UUID.test(input.request_id))blocked('QA_BOOKING_BAD_ID');
 if(typeof input.subject!=='string'||input.subject.trim().length<3||
    input.subject.trim().length>140||/[\u0000-\u001f\u007f]/.test(input.subject))blocked('QA_BOOKING_BAD_SUBJECT');
 if(!allowedModes.has(input.modality))blocked('QA_BOOKING_BAD_MODALITY');
 if(!COLOMBIA.test(input.start)||!COLOMBIA.test(input.end))blocked('QA_BOOKING_TIMEZONE');
 const a=calendarInstant(input.start),b=calendarInstant(input.end);
 if(!Number.isFinite(a)||!Number.isFinite(b)||b-a<15*60000||b-a>12*HOUR)
  blocked('QA_BOOKING_BAD_INTERVAL');
 if(!Number.isFinite(now)||a-now<24*HOUR||a-now>90*24*HOUR)
  blocked('QA_BOOKING_NOT_IN_WINDOW');
 return Object.freeze({project_id:input.project_id.toLowerCase(),request_id:input.request_id.toLowerCase(),
  subject:input.subject.trim(),modality:input.modality,start:input.start,end:input.end});
}

// The actor is a server assertion, NEVER copied from the form body or trusted from the browser.
export function assertQaBookingActor(actor,intent){
 if(actor?.source!=='supabase_server_verified'||actor?.aal!=='aal2'||actor?.active!==true||
    !UUID.test(actor?.user_id)||actor.project_id!==intent.project_id||
    !['admin','coordinator'].includes(actor.role))blocked('QA_BOOKING_UNAUTHORIZED');
 return true;
}

export function assertQaBookingTestTarget(target){
 if(target?.mode!=='isolated_test'||target?.writeEnabled!==false||
    typeof target.testCalendarId!=='string'||!GROUP_CALENDAR.test(target.testCalendarId)||
    typeof target.sourceCalendarId!=='string'||!GROUP_CALENDAR.test(target.sourceCalendarId)||
    target.testCalendarId===target.sourceCalendarId)blocked('QA_BOOKING_TEST_TARGET_REQUIRED');
 return true;
}

export function qaBookingAvailabilityWindow(intent){
 const a=calendarInstant(intent.start),b=calendarInstant(intent.end);
 if(!Number.isFinite(a)||!Number.isFinite(b)||a>=b)blocked('QA_BOOKING_BAD_INTERVAL');
 return Object.freeze({start:new Date(a-BUFFER).toISOString(),end:new Date(b+BUFFER).toISOString()});
}

export async function qaBookingFingerprint(intent,actor){
 assertQaBookingActor(actor,intent);
 const canonical=JSON.stringify([actor.user_id,intent.project_id,intent.request_id,
  intent.subject,intent.modality,new Date(intent.start).toISOString(),new Date(intent.end).toISOString()]);
 const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical));
 return [...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,'0')).join('');
}

export async function preflightQaBooking({input,actor,target,readBusy,now=Date.now()}){
 const intent=normalizeQaBookingIntent(input,{now});
 assertQaBookingActor(actor,intent);
 assertQaBookingTestTarget(target);
 if(typeof readBusy!=='function')blocked('QA_BOOKING_PROVIDER_MISSING');
 const window=qaBookingAvailabilityWindow(intent);
 let busy;
 try{
  const provider=await readBusy({calendar_id:target.testCalendarId,
   project_id:intent.project_id,start:window.start,end:window.end});
  if(provider?.source!=='google_freebusy'||provider?.timezone!=='America/Bogota')
   blocked('QA_BOOKING_PROVIDER_UNVERIFIED');
  busy=validateCalendarAvailabilityResponse(provider,intent.project_id);
 }catch{blocked('QA_BOOKING_PROVIDER_UNVERIFIED');}
 if(calendarHasConflict({busy,start:intent.start,end:intent.end}))
  blocked('QA_BOOKING_SLOT_OCCUPIED');
 const fingerprint=await qaBookingFingerprint(intent,actor);
 return Object.freeze({status:'QA_TEST_PREFLIGHT_ONLY',booking_authorized:false,
  event_created:false,invites_sent:false,meet_created:false,
  project_id:intent.project_id,request_id:intent.request_id,
  start:intent.start,end:intent.end,fingerprint,
  verified_source:'google_freebusy',checked_window:window});
}
