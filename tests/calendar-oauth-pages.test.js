import assert from 'node:assert/strict';
import test from 'node:test';
import {QA_URL} from '../qa/security/private-worker-bootstrap-core.mjs';
import {calendarOAuthPages} from '../backend/src/calendar-oauth/pages-runtime.mjs';
import {onRequest} from '../functions/api/integrations/google-calendar/oauth/[operation].js';

const callback = '/api/integrations/google-calendar/oauth/callback';
const env = {
  ADPHOR_CALENDAR_OAUTH_ENABLED: 'true',
  ADPHOR_CALENDAR_QA_HYPERDRIVE: {
    connectionString: 'postgresql://synthetic_user:synthetic_password@hyperdrive.example.test:5432/postgres',
  },
  // Legacy secret is intentionally present to prove there is no direct-TCP fallback.
  ADPHOR_CALENDAR_OAUTH_DATABASE_URL: 'unused-synthetic-legacy-secret',
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

test('Pages completes Cloudflare Access verification before opening the QA database handle', async () => {
  const request = new Request(QA_URL + callback, {headers: {'Cf-Access-Jwt-Assertion': 'invalid'}});
  for (const binding of [undefined, {}, {connectionString: ''},
    {connectionString: 'https://not-postgres.example.test'}, {connectionString: 'postgresql://missing-credentials.example.test/postgres'},
    {connectionString: 'postgresql://synthetic:secret@host.example.test/postgres#fragment'}]) {
    let opens = 0;
    const result = await calendarOAuthPages({request, env: {
      ...env, ADPHOR_CALENDAR_QA_HYPERDRIVE: binding,
    }}, () => { opens++; throw Error('must not connect without valid Hyperdrive'); });
    assert.equal(result.status, 403);
    assert.equal(opens, 0);
    assert.equal(await result.text(), '');
  }
  let opened = 0;
  let closed = 0;
  const response = await calendarOAuthPages({request, env}, (connectionString, options) => {
    opened++;
    assert.equal(connectionString, env.ADPHOR_CALENDAR_QA_HYPERDRIVE.connectionString);
    assert.equal(options.max, 1);
    assert.equal(options.fetch_types, false);
    assert.equal(options.connect_timeout, 5);
    assert.equal(options.ssl, undefined); // Hyperdrive validates the origin CA, not the Workerd socket.
    assert.notEqual(connectionString, env.ADPHOR_CALENDAR_OAUTH_DATABASE_URL);
    return {
      unsafe: () => assert.fail('unverified Access must never issue SQL'),
      async end() {closed++;},
    };
  });
  assert.equal(response.status, 403);
  assert.equal(opened, 0);
  assert.equal(closed, 0);
  assert.equal(response.headers.get('set-cookie'), null);
});

test('the OAuth pooler probe requires Access, AAL2 and current scope before a metadata-only query', async () => {
  const {probeCalendarDatabase} = await import('../backend/src/calendar-oauth/pages-runtime.mjs');
  const path = '/api/integrations/google-calendar/oauth/readiness?project=pilot';
  const request = new Request(QA_URL + path, {method:'POST',headers:{
    Origin:QA_URL, Authorization:'Bearer fixture',
  }});
  let calls=0;
  const checks = {dedicated:true,constrained_login:true,inherited_state_role:true,rls:true,can_store:true,cannot_read_payload:true,cannot_read:true,browser_denied:true};
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

test('readiness returns only a fixed stage code when Access, session, membership or PostgreSQL fails', async () => {
  const {probeCalendarDatabase} = await import('../backend/src/calendar-oauth/pages-runtime.mjs');
  const request=new Request(QA_URL+'/api/integrations/google-calendar/oauth/readiness?project=pilot',
    {method:'POST',headers:{Origin:QA_URL,Authorization:'Bearer fixture'}});
  const dependencies={
    verifyAccess:async()=>({subject:'fixture'}),
    verifySession:async()=>({userId:'fixture',aal:'aal2'}),
    lookupRole:async()=> 'admin',
    connect:()=>({unsafe:async()=>[]}),
  };
  for(const [overrides,expected,status] of [
    [{verifyAccess:async()=>null},'CAL_ACCESS',403],
    [{verifySession:async()=>({userId:'fixture',aal:'aal1'})},'CAL_AAL2',403],
    [{lookupRole:async()=>null},'CAL_MEMBERSHIP',403],
    [{connect:()=>{throw Error('private fixture');}},'CAL_DB_CONFIG',503],
    ...[['28P01','CAL_DB_LOGIN'],['ERR_TLS_CERT_ALTNAME_INVALID','CAL_DB_TLS'],['42501','CAL_DB_SQL'],
       ['CONNECT_TIMEOUT','CAL_DB_TRANSPORT']].map(([code,expect])=>[
      {connect:()=>({unsafe:async()=>{throw Object.assign(Error('private fixture'),{code});}})},expect,503]),
    [{},'CAL_DB_PERMISSIONS',503],
  ]){
    const result=await probeCalendarDatabase(request.clone(),{...dependencies,...overrides});
    assert.equal(result.status,status);
    assert.equal(result.headers.get('X-ADPHOR-Calendar-Code'),expected);
    assert.equal(result.headers.get('X-ADPHOR-Calendar-Reason'),expected==='CAL_DB_TRANSPORT'?'CONNECT_TIMEOUT':null);
    assert.equal(await result.text(),'');
    assert.doesNotMatch(JSON.stringify([...result.headers]),/private fixture/);
  }
});

test('the OAuth Pages entrypoint dispatches all operations and denies an anonymous readiness probe', async () => {
  const root = QA_URL + '/api/integrations/google-calendar/oauth/';
  for (const [operation, method, expected] of [
    ['readiness?project=source-28', 'POST', 403],
    ['start?project=source-28', 'POST', 404],
    ['callback', 'GET', 404],
    ['finalize?project=source-28', 'POST', 404],
  ]) {
    const result = await onRequest({
      request: new Request(root + operation, {method, headers: {Origin: QA_URL}}),
      env: {ADPHOR_CALENDAR_OAUTH_ENABLED: 'false'},
    });
    assert.equal(result.status, expected, operation);
    assert.equal(result.headers.get('Cache-Control'), 'no-store');
  }
});

test('readiness accepts an empty body stream and rejects payloads and invalid query parameters', async () => {
  const {probeCalendarDatabase} = await import('../backend/src/calendar-oauth/pages-runtime.mjs');
  const root = QA_URL + '/api/integrations/google-calendar/oauth/readiness?';
  const init = {method:'POST', headers:{Origin:QA_URL,Authorization:'Bearer fixture'}};
  let calls = 0;
  const dependencies = {
    verifyAccess:async()=>({subject:'fixture'}),
    verifySession:async()=>({userId:'fixture',aal:'aal2'}),
    lookupRole:async()=> 'admin',
    connect:()=>({unsafe:async()=>{
      calls++;
      return [{dedicated:true,constrained_login:true,inherited_state_role:true,rls:true,can_store:true,cannot_read_payload:true,cannot_read:true,browser_denied:true}];
    }}),
  };
  const emptyStream = new Request(root+'project=source-28',{
    ...init,body:new Uint8Array(),
  });
  assert.notEqual(emptyStream.body,null);
  assert.equal((await probeCalendarDatabase(emptyStream,dependencies)).status,204);
  assert.equal((await probeCalendarDatabase(new Request(root+'project=source-28',init),dependencies)).status,204);
  for (const [query,body] of [
    ['project=source-28','{}'],
    ['project=source-28',' '],
    ['project=../invalid',undefined],
    ['project=source-28&project=source-28',undefined],
    ['project=source-28&extra=1',undefined],
    ['other=source-28',undefined],
  ]) {
    const result=await probeCalendarDatabase(new Request(root+query,{...init,body}),dependencies);
    assert.equal(result.status,400,query);
    assert.equal(result.headers.get('X-ADPHOR-Calendar-Code'),'CAL_REQUEST');
  }
  for (const [overrides,code] of [
    [{verifyAccess:async()=>null},'CAL_ACCESS'],
    [{verifySession:async()=>({userId:'fixture',aal:'aal1'})},'CAL_AAL2'],
    [{lookupRole:async()=>null},'CAL_MEMBERSHIP'],
  ]) {
    const result=await probeCalendarDatabase(new Request(root+'project=source-28',{
      ...init,body:new Uint8Array(),
    }),{...dependencies,...overrides});
    assert.equal(result.status,403);
    assert.equal(result.headers.get('X-ADPHOR-Calendar-Code'),code);
  }
  assert.equal(calls,2);
});


test('transport diagnostics expose only an allowlisted runtime code to the authorized readiness caller', async () => {
  const {probeCalendarDatabase}=await import('../backend/src/calendar-oauth/pages-runtime.mjs');
  const request=new Request(QA_URL+'/api/integrations/google-calendar/oauth/readiness?project=pilot',
    {method:'POST',headers:{Origin:QA_URL,Authorization:'Bearer fixture'}});
  const dependencies={
    verifyAccess:async()=>({subject:'fixture'}),
    verifySession:async()=>({userId:'fixture',aal:'aal2'}),
    lookupRole:async()=> 'admin',
    connect:()=>({unsafe:async()=>{throw Object.assign(Error('private host, password and token'),{code:'ECONNRESET'});}}),
  };
  const response=await probeCalendarDatabase(request,dependencies);
  assert.equal(response.status,503);
  assert.equal(response.headers.get('X-ADPHOR-Calendar-Code'),'CAL_DB_TRANSPORT');
  assert.equal(response.headers.get('X-ADPHOR-Calendar-Reason'),'ECONNRESET');
  assert.equal(await response.text(),'');
  assert.doesNotMatch(JSON.stringify([...response.headers]),/private host|password|token/);
  for (const expected of ['CONNECT_TIMEOUT','CONNECTION_CLOSED','CONNECTION_ENDED','CONNECTION_DESTROYED']) {
    const known=await probeCalendarDatabase(request,{
      ...dependencies,
      connect:()=>({unsafe:async()=>{throw Object.assign(Error('private host and credentials'),{code:expected});}}),
    });
    assert.equal(known.status,503);
    assert.equal(known.headers.get('X-ADPHOR-Calendar-Code'),'CAL_DB_TRANSPORT');
    assert.equal(known.headers.get('X-ADPHOR-Calendar-Reason'),expected);
    assert.equal(await known.text(),'');
    assert.doesNotMatch(JSON.stringify([...known.headers]),/private host|credentials/);
  }
  const wrapped=await probeCalendarDatabase(request,{
    ...dependencies,
    connect:()=>({unsafe:async()=>{throw Object.assign(Error('private'),{code:'UNRECOGNIZED',cause:Object.assign(Error('secret'),{code:'CONNECT_TIMEOUT'})});}}),
  });
  assert.equal(wrapped.headers.get('X-ADPHOR-Calendar-Reason'),'CONNECT_TIMEOUT');
  const unrecognized=await probeCalendarDatabase(request,{
    ...dependencies,
    connect:()=>({unsafe:async()=>{throw Object.assign(Error('Bearer SECRET'),{code:'Bearer_SECRET'});}}),
  });
  assert.equal(unrecognized.headers.get('X-ADPHOR-Calendar-Reason'),'OTHER');
  assert.doesNotMatch(JSON.stringify([...unrecognized.headers]),/Bearer|SECRET/);
});


test('invalid Access signature is checked before Pages opens a PostgreSQL handle', async () => {
  const originalFetch=globalThis.fetch;
  const signing={name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'};
  const pair=await crypto.subtle.generateKey({...signing,modulusLength:2048,publicExponent:Uint8Array.of(1,0,1)},true,['sign','verify']);
  const jwk={...await crypto.subtle.exportKey('jwk',pair.publicKey),kid:'qa-access-key',alg:'RS256',use:'sig'};
  const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
  const now=Math.floor(Date.now()/1000);
  const header=encode({alg:'RS256',kid:jwk.kid});
  const claims=encode({iss:env.ADPHOR_CALENDAR_OAUTH_ACCESS_ISSUER,aud:[env.ADPHOR_CALENDAR_OAUTH_ACCESS_AUDIENCE],type:'app',exp:now+60,sub:'qa-subject'});
  const invalidSignature=Buffer.alloc(256,0).toString('base64url');
  const request=new Request(QA_URL+'/api/integrations/google-calendar/oauth/start?project=source-28',{
    method:'POST',headers:{
      Origin:QA_URL,Authorization:'Bearer fixture',
      'Cf-Access-Jwt-Assertion':header+'.'+claims+'.'+invalidSignature,
    },
  });
  let opens=0;
  globalThis.fetch=async url=>{
    assert.equal(url,env.ADPHOR_CALENDAR_OAUTH_ACCESS_ISSUER+'/cdn-cgi/access/certs');
    return Response.json({keys:[jwk]});
  };
  try {
    const response=await calendarOAuthPages({request,env},()=>{opens++;throw Error('must not open before Access verification');});
    assert.equal(response.status,403);
    assert.equal(opens,0);
  } finally {
    globalThis.fetch=originalFetch;
  }
});
