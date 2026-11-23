import assert from 'node:assert/strict';
import test from 'node:test';
import {QA_URL} from '../qa/security/private-worker-bootstrap-core.mjs';
import {calendarOAuthPages} from '../backend/src/calendar-oauth/pages-runtime.mjs';
import {onRequest} from '../functions/api/integrations/google-calendar/oauth/[operation].js';

const callback = '/api/integrations/google-calendar/oauth/callback';
const env = {
  ADPHOR_CALENDAR_OAUTH_ENABLED: 'true',
  ADPHOR_CALENDAR_OAUTH_DATABASE_URL:
    'postgresql://adphor_qa_calendar_oauth_login.qfctnnnnltghepwujpdm:fixture%40password@aws-0-us-east-1.pooler.supabase.com:5432/postgres',
  ADPHOR_CALENDAR_OAUTH_ENCRYPTION_KEY: 'A'.repeat(43),
  ADPHOR_CALENDAR_OAUTH_ACCESS_ISSUER: 'https://fixture.cloudflareaccess.com',
  ADPHOR_CALENDAR_OAUTH_ACCESS_AUDIENCE: 'a'.repeat(64),
  ADPHOR_CALENDAR_OAUTH_GOOGLE_CLIENT_ID: 'fixture-client',
  ADPHOR_CALENDAR_OAUTH_GOOGLE_CLIENT_SECRET: 'fixture-secret',
  ADPHOR_CALENDAR_OAUTH_PILOT_EMAIL: 'pilot@example.test',
  VITE_SUPABASE_ANON_KEY: 'sb_publishable_fixture',
};

test('Pages refuses other hosts, disabled rollout and unauthenticated access before opening PostgreSQL', async () => {
  const open = () => assert.fail('must never obtain a database handle');
  for (const [url, config, init, status] of [
    ['https://another-preview.example' + callback, env, {}, 404],
    [QA_URL + callback, {}, {}, 404],
    [QA_URL + callback, env, {method: 'POST'}, 405],
    [QA_URL + callback, env, {}, 403],
    [QA_URL + '/api/integrations/google-calendar/oauth/other', env, {}, 404],
  ]) {
    const response = await calendarOAuthPages({request: new Request(url, init), env: config}, open);
    assert.equal(response.status, status);
    assert.equal(response.headers.get('cache-control'), 'no-store');
  }
  assert.equal((await onRequest({request: new Request(QA_URL + callback), env: {}})).status, 404);
});

test('Pages pins the QA database and TLS, and releases the handle on failed Access validation', async () => {
  const request = new Request(QA_URL + callback, {headers: {'Cf-Access-Jwt-Assertion': 'invalid'}});
  for (const suffix of ['?sslmode=disable', '#fragment']) {
    const response = await calendarOAuthPages({request, env: {
      ...env, ADPHOR_CALENDAR_OAUTH_DATABASE_URL: env.ADPHOR_CALENDAR_OAUTH_DATABASE_URL + suffix,
    }}, () => assert.fail('invalid connection configuration'));
    assert.equal(response.status, 503);
  }
  let opened = 0;
  let closed = 0;
  const response = await calendarOAuthPages({request, env}, options => {
    opened++;
    assert.equal(options.ssl, 'verify-full');
    assert.equal(options.max, 1);
    assert.equal(options.port, 5432);
    assert.equal(options.password, 'fixture@password');
    return {
      unsafe: () => assert.fail('unverified Access must never issue SQL'),
      async end() {closed++;},
    };
  });
  assert.equal(response.status, 403);
  assert.equal(opened, 1);
  assert.equal(closed, 1);
});

test('the OAuth pooler probe requires Access, AAL2 and current scope before a metadata-only query', async () => {
  const {probeCalendarDatabase} = await import('../backend/src/calendar-oauth/pages-runtime.mjs');
  const path = '/api/integrations/google-calendar/oauth/readiness?project=pilot';
  const request = new Request(QA_URL + path, {method:'POST',headers:{
    Origin:QA_URL, Authorization:'Bearer fixture',
  }});
  let calls=0;
  const checks = {dedicated:true,rls:true,can_store:true,cannot_read:true,browser_denied:true};
  const dependencies = {
    verifyAccess:async()=>({subject:'access-owner'}),
    verifySession:async()=>({userId:'user',aal:'aal2'}),
    lookupRole:async({projectId})=>projectId==='pilot'?'coordinator':null,
    connect:()=>({unsafe:async sql=>{
      calls++;
      assert.match(sql,/^SELECT/);
      assert.doesNotMatch(sql,/\b(?:INSERT INTO|DELETE FROM|UPDATE)\b/);
      return [checks];
    }}),
  };
  for(const overrides of [
    {verifyAccess:async()=>null},
    {verifySession:async()=>({userId:'user',aal:'aal1'})},
    {lookupRole:async()=>null},
  ]) assert.equal((await probeCalendarDatabase(request.clone(), {...dependencies,...overrides})).status,403);
  assert.equal(calls,0);
  assert.equal((await probeCalendarDatabase(request.clone(),dependencies)).status,204);
  checks.cannot_read=false;
  assert.equal((await probeCalendarDatabase(request.clone(),dependencies)).status,503);
  assert.equal(calls,2);
});

test('readiness remains reachable for protected diagnostics while the OAuth feature is off', async () => {
  const request=new Request(QA_URL+'/api/integrations/google-calendar/oauth/readiness?project=pilot',
    {method:'POST',headers:{Origin:QA_URL}});
  const response=await calendarOAuthPages({request,env:{ADPHOR_CALENDAR_OAUTH_ENABLED:'false'}},
    ()=>assert.fail('No Access assertion means no database handle.'));
  assert.equal(response.status,403);
});
