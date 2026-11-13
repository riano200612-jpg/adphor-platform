import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {QA_FRONTEND,QA_PROJECT_URL,validateAvailabilityBody,parseValidatedAal2,normalizeBusy} from '../supabase/functions/qa-calendar-availability/core.js';
import {validateCalendarAvailabilityResponse} from '../src/js/services/calendar-availability.js';
const code=readFileSync(new URL('../supabase/functions/qa-calendar-availability/index.ts',import.meta.url),'utf8');
const good={project_id:'a1b2c3d4-0000-0000-0000-000000000001',start:'2026-11-16T10:00:00-05:00',end:'2026-11-16T12:00:00-05:00'};
test('calendar backend is tied to QA current Preview, Supabase Auth, RLS and no service-role writes',()=>{
 assert.equal(QA_FRONTEND,'https://qa-integral-claude-reviewed.adphor-platform.pages.dev');
 assert.equal(QA_PROJECT_URL,'https://qfctnnnnltghepwujpdm.supabase.co');
 assert.ok(code.includes('/auth/v1/user'));
 assert.ok(code.includes('/rest/v1/memberships'));
 assert.ok(code.includes('parseValidatedAal2'));
 assert.ok(code.includes('Google Calendar corporativo no configurado en QA.'));
 assert.ok(code.includes("'Cache-Control':'no-store'"));
 assert.doesNotMatch(code,/SUPABASE_SERVICE_ROLE_KEY|sb_secret_|calendar\/v3\/events|events\.insert/);
});
test('calendar body rejects extra fields, unapproved tenants, or invalid times',()=>{
 assert.deepEqual(validateAvailabilityBody(good),good);
 for(const payload of [{...good,project_id:'../evil'},{...good,start:'2026-11-16T10:00:00'},{...good,end:good.start},{...good,end:'2026-11-25T12:00:00-05:00'},{...good,admin:true},{...good,project_id:''},null]){
  assert.throws(()=>validateAvailabilityBody(payload));
 }
});
test('AAL2 requires matching user and role, AFTER Auth server verification',()=>{
 const jwt=body=>`header.${Buffer.from(JSON.stringify(body)).toString('base64url')}.signature`;
 const ok=jwt({sub:'user-123',aal:'aal2',role:'authenticated'});
 assert.equal(parseValidatedAal2(ok,'user-123'),true);
 assert.equal(parseValidatedAal2(ok,'another'),false);
 assert.equal(parseValidatedAal2(jwt({sub:'user-123',aal:'aal1',role:'authenticated'}),'user-123'),false);
 assert.equal(parseValidatedAal2(jwt({sub:'user-123',aal:'aal2',role:'anon'}),'user-123'),false);
 assert.equal(parseValidatedAal2('bad','user-123'),false);
});
test('Google busy response strips provider detail, rejects bad windows, and matches client schema',()=>{
 const id='qa-calendar';
 const input={calendars:{[id]:{busy:[{start:good.start,end:good.end,description:'private'}]}}};
 const busy=normalizeBusy(input,id);
 assert.deepEqual(busy,[{start:good.start,end:good.end}]);
 assert.deepEqual(validateCalendarAvailabilityResponse({project_id:good.project_id,timezone:'America/Bogota',busy},good.project_id),busy);
 for(const invalid of [{},{calendars:{[id]:{errors:[{reason:'forbidden'}],busy:[]}}},{calendars:{[id]:{busy:[{start:'bad',end:good.end}]}}}])assert.throws(()=>normalizeBusy(invalid,id));
});
