import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 canProbeQaCorporateCalendar,probeQaCorporateCalendar,describeQaCorporateCalendarProbe,
 qaCorporateCalendarProbeError
} from '../src/js/services/qa-calendar-probe.js';

const now=Date.parse('2026-11-15T13:00:00Z');
function enabled(overrides={}){
 return {mode:'cloud',qaCalendarEdgeEnabled:true,calendarAvailabilityConfigured:true,
  meetingAvailability:async()=>[],...overrides};
}
const args=(repo=enabled(),overrides={})=>({repo,projectId:'p1',role:'admin',now,...overrides});

test('Read-only QA connection probe queries one exact future hour under tenant context',async()=>{
 const calls=[];
 const repo=enabled({meetingAvailability:async(...a)=>{calls.push(a);return [{
  start:'2026-11-16T13:15:00Z',end:'2026-11-16T13:35:00Z',description:'private'
 }];}});
 const result=await probeQaCorporateCalendar(args(repo));
 assert.deepEqual(calls,[['p1','2026-11-16T13:00:00.000Z','2026-11-16T14:00:00.000Z']]);
 assert.deepEqual(result,{source:'qa-calendar-availability',
  checkedAt:'2026-11-15T13:00:00.000Z',busyCount:1,readonly:true});
 const info=describeQaCorporateCalendarProbe(result);
 assert.match(info,/respuesta de Google Calendar freeBusy/);
 assert.match(info,/no se creó ni cambió ningún evento/i);
 assert.match(info,/no certifica todavía la cuenta organizadora/);
 assert.doesNotMatch(info,/private|2026-11-16T14|invitados:|reservó/);
});

test('Probe requires QA Edge, admin/coordinator and valid project before fetching',async()=>{
 for(const field of [
  {repo:enabled({mode:'demo-calendar'})},{repo:enabled({mode:'demo'})},
  {repo:enabled({qaCalendarEdgeEnabled:false})},
  {repo:enabled({calendarAvailabilityConfigured:false})},
  {repo:enabled({meetingAvailability:null})},
  {role:'viewer'},{role:'technician'},{projectId:'../private'},
  {projectId:''}
 ]){
  let calls=0;
  const r=field.repo||enabled({meetingAvailability:async()=>{calls++;return [];}});
  const params=args(r,field);
  assert.equal(canProbeQaCorporateCalendar(params),false);
  await assert.rejects(probeQaCorporateCalendar(params),/QA_CALENDAR_PROBE_NOT_AUTHORIZED/);
  assert.equal(calls,0);
 }
 assert.equal(canProbeQaCorporateCalendar(args(enabled(),{role:'coordinator'})),true);
});

test('Missing OAuth and MFA failures stay distinct, without leaking tokens or tenant data',async()=>{
 for(const [internal,publicText] of [
  ['El calendario corporativo aún no está configurado en QA.',/respondió 503/],
  ['La consulta requiere autorización y MFA AAL2.',/MFA AAL2/],
  ['JWT_PRIVATE_TOKEN other owner calendar ID',/No se pudo confirmar/]
 ]){
  const repo=enabled({meetingAvailability:async()=>{throw Error(internal);}});
  await assert.rejects(probeQaCorporateCalendar(args(repo)));
  const message=qaCorporateCalendarProbeError(new Error(internal));
  assert.match(message,publicText);
  assert.doesNotMatch(message,/JWT_PRIVATE_TOKEN|owner calendar ID/);
  assert.doesNotMatch(message,/horario libre confirmado|reserva confirmada|se reservó/i);
 }
});

test('Malformed and overfull Google replies cannot be treated as a successful probe',async()=>{
 for(const reply of [{busy:[]},[null],[{start:'2026-11-16T13:00:00Z',end:'bad'}],
  Array.from({length:1001},()=>({start:'2026-11-16T13:00:00Z',end:'2026-11-16T13:30:00Z'}))]){
  await assert.rejects(probeQaCorporateCalendar(args(enabled({meetingAvailability:async()=>reply}))));
 }
 for(const time of [NaN,-1,Date.parse('2101-01-01T00:00:00Z')])
  await assert.rejects(probeQaCorporateCalendar(args(enabled(),{now:time})));
 assert.throws(()=>describeQaCorporateCalendarProbe({source:'demo',readonly:true,busyCount:0,checkedAt:new Date().toISOString()}));
});

test('Live diagnostic is wired to QA Edge flag rather than a generic agents API, and does not expose secrets',()=>{
 const repo=readFileSync(new URL('../src/js/services/supabase.js',import.meta.url),'utf8');
 const ui=readFileSync(new URL('../src/js/ui-meeting-assessment.js',import.meta.url),'utf8');
 const diagnostic=readFileSync(new URL('../src/js/ui-qa-calendar-probe.js',import.meta.url),'utf8');
 const logic=readFileSync(new URL('../src/js/services/qa-calendar-probe.js',import.meta.url),'utf8');
 assert.match(repo,/qaCalendarEdgeEnabled,/);
 assert.match(ui,/mountQaCalendarProbe\(diagnostics,\{repo,projectId,role,isProjectCurrent\}\)/);
 assert.match(diagnostic,/dataset\.qaCalendarProbe/); // replaced below
 assert.doesNotMatch(logic,/fetch\(|service_role|refresh_token|localStorage|calendarId|\.insert\(|\.update\(|\.delete\(/);
});

test('private Calendar diagnostic displays only allowlisted error codes',async()=>{
 const {privateCalendarDiagnosticMessage}=await import('../src/js/ui-qa-calendar-probe.js');
 assert.match(privateCalendarDiagnosticMessage(Error('CAL_DB_LOGIN')), /CAL_DB_LOGIN.*login dedicado/);
 assert.match(privateCalendarDiagnosticMessage(Error('CAL_AAL2')), /CAL_AAL2.*MFA AAL2/);
 const message=privateCalendarDiagnosticMessage(Error('fixture unsafe connection data'));
 assert.match(message,/CAL_NO_DIAGNOSTIC/);
 assert.doesNotMatch(message,/unsafe connection data/);
});
