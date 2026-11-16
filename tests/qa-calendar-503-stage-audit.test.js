import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../supabase/functions/qa-calendar-availability/index.ts',import.meta.url),'utf8');

test('P0 diagnostic uses only four enumerated 503 stages and generated request ID',()=>{
 for(const [stage,body] of [
  ['supabase_runtime','Servicio QA no configurado.'],
  ['auth_upstream','No se pudo verificar la sesión QA.'],
  ['membership_upstream','No se pudo verificar la membresía QA.'],
  ['oauth_configuration','Google Calendar corporativo no configurado en QA.']
 ]){
  assert.ok(source.includes("unavailable('"+stage+"','"+body+"')"),stage);
 }
 assert.match(source,/const requestId=crypto\.randomUUID\(\)/);
 assert.match(source,/event:'adphor_qa_calendar_503',request_id:requestId,stage,status:503/);
 assert.equal((source.match(/return unavailable\(/g)||[]).length,4);
 assert.equal((source.match(/return reply\(503/g)||[]).length,1);
});

test('P0 diagnostic logging contains only fixed event, identifier, stage and 503 status',()=>{
 const start=source.indexOf('const unavailable='),end=source.indexOf('const authorizedOrigin',start);
 assert.ok(start>0&&end>start);
 const diagnostic=source.slice(start,end);
 assert.match(diagnostic,/console\.warn\(JSON\.stringify\(\{/);
 assert.doesNotMatch(diagnostic,/Bearer|Authorization|jwt|userId|projectId|calendarId|secret|refresh_token|body\.|req\./i);
 assert.match(diagnostic,/return reply\(503,\{error:message\},true\)/);
 assert.doesNotMatch(source,/console\.(?:warn|info|log|error)\(.*(?:authorization|headers|bearer|token|calendarId)/i);
});

test('JWT/RLS, Google freeBusy read-only contract and response handling remain unchanged',()=>{
 for(const fragment of [
  "if(!authorizedOrigin)return reply(403,{error:'Origen QA no autorizado.'},false)",
  "if(req.method==='OPTIONS')return new Response(null,{status:204",
  "const bearer=req.headers.get('Authorization')||''",
  "if(!match||match[1].length>8192)return reply(401",
  "body=validateAvailabilityBody(JSON.parse(bytes))",
  "parseValidatedAal2(match[1],user.id)",
  "if(!Array.isArray(rows)||rows.length!==1||!['admin','coordinator'].includes(rows[0]?.role))",
  "const calendarId=Deno.env.get('ADPHOR_QA_CALENDAR_ID')",
  "Deno.env.get('ADPHOR_QA_CALENDAR_OAUTH_REFRESH_TOKEN')",
  "'https://www.googleapis.com/calendar/v3/freeBusy'",
  "return reply(200,{project_id:body.project_id,timezone:'America/Bogota',source:QA_SOURCE,busy},true)"
 ]) assert.ok(source.includes(fragment),fragment);
 assert.doesNotMatch(source,/calendar\/v3\/events|events\.insert|SUPABASE_SERVICE_ROLE_KEY|sb_secret_/);
});
