import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {missingQaCalendarConfigMask} from '../supabase/functions/qa-calendar-availability/core.js';

test('presence mask distinguishes all 16 subsets of the four existing names only',()=>{
 for(let mask=0;mask<16;mask++){
  const vals=Array.from({length:4},(_,i)=>mask&(1<<i)?undefined:'synthetic-value-'+i);
  const actual=missingQaCalendarConfigMask(vals[0],{
   client_id:vals[1],client_secret:vals[2],refresh_token:vals[3],
  });
  assert.equal(actual,mask,'bitmask '+mask);
  assert.ok(actual>=0&&actual<16);
 }
 assert.equal(missingQaCalendarConfigMask('calendar-id',{
  client_id:'client',client_secret:'secret',refresh_token:'refresh',
 }),0);
 assert.equal(missingQaCalendarConfigMask(undefined,undefined),15);
});

test('presence checking does not attempt to reveal, compare, or log any credential value',()=>{
 const leaks=[];
 const credential=new Proxy({},{
  get(_target,key){
   leaks.push(String(key));
   if(key==='client_id')return 'synthetic-client';
   if(key==='client_secret')return 'synthetic-secret';
   if(key==='refresh_token')return 'synthetic-refresh';
  },
  ownKeys(){throw Error('OAuth object enumeration forbidden');}
 });
 assert.equal(missingQaCalendarConfigMask('calendar',credential),0);
 assert.deepEqual(leaks,['client_id','client_secret','refresh_token']);
});

test('missing flags are logged only after backend verified session, AAL2 and scoped membership',()=>{
 const code=readFileSync(new URL('../supabase/functions/qa-calendar-availability/index.ts',import.meta.url),'utf8');
 const session=code.indexOf('parseValidatedAal2(match[1],user.id)');
 const membership=code.indexOf("if(!Array.isArray(rows)||rows.length!==1");
 const presence=code.indexOf('const missingMask=missingQaCalendarConfigMask(calendarId,oauth)');
 const logger=code.indexOf("event:'adphor_qa_calendar_missing_config'");
 assert.ok(session>=0&&membership>session&&presence>membership&&logger>presence);
 assert.match(code,/if\(missingMask\)\{\s*console\.warn\(JSON\.stringify\(\{\s*event:'adphor_qa_calendar_missing_config',request_id:requestId,missing_mask:missingMask/);
 assert.match(code,/return unavailable\('oauth_configuration','Google Calendar corporativo no configurado en QA\.'\)/);
 assert.doesNotMatch(code,/console\.(?:warn|log|error|info)\(\s*(?:calendarId|oauth|bearer|req\.headers)/);
 assert.match(code,/return reply\(200,\{project_id:body\.project_id,timezone:'America\/Bogota',source:QA_SOURCE,busy\},true\)/);
 assert.doesNotMatch(code,/calendar\/v3\/events|events\.insert|SUPABASE_SERVICE_ROLE_KEY|sb_secret_/);
});

test('failure response remains generic without field identifiers or mask',()=>{
 const code=readFileSync(new URL('../supabase/functions/qa-calendar-availability/index.ts',import.meta.url),'utf8');
 assert.ok(code.includes("return reply(503,{error:message},true)"));
 assert.doesNotMatch(code,/reply\(503,\{[^}]*missing_mask/);
 assert.doesNotMatch(code,/return reply\(200,[^;]*missing_mask/);
});
