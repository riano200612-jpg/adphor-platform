import test from 'node:test';
import assert from 'node:assert/strict';
import { agentApiOrigin, fetchAgentRuns, fetchAgentReadiness, agentRuleRequest } from '../src/js/services/agent-api.js';
import { historyCards, draftCard, mountAgentHistory } from '../src/js/ui-agent-history.js';

test('HTTP is restricted to development loopback', () => {
  assert.equal(agentApiOrigin('http://localhost:5173', true), 'http://localhost:5173');
  assert.throws(() => agentApiOrigin('http://localhost:5173', false));
  assert.throws(() => agentApiOrigin('https://user:password@example.com'));
});
test('request uses the session token, scopes the query and rejects mixed properties', async () => {
  await assert.rejects(fetchAgentRuns({origin:'https://api.example.com',token:'test-token',projectId:'demo-01',fetcher: async (url, options) => {
    assert.equal(url.searchParams.get('project_id'), 'demo-01');
    assert.equal(options.headers.Authorization, 'Bearer test-token');
    assert.equal(options.redirect, 'error');
    return {ok:true,status:200,json:async()=>({items:[{project_id:'other'}]})};
  }}), /respuesta no válida/);
});
test('authentication failures cannot appear as empty success', async () => {
  await assert.rejects(fetchAgentRuns({origin:'https://api.example.com',token:'test',projectId:'demo-01',fetcher:async()=>({ok:false,status:401})}), /sesión terminó/);
});
test('database strings are escaped before rendering', () => {
  const html = historyCards([{status:'<img onerror=alert(1)>',id:'<script>',engine_kind:'rules'}]);
  assert.equal(html.includes('<img'), false);
  assert.equal(html.includes('<script>'), false);
});
test('rule execution sends only project and idempotency key, never an approval', async () => {
  const data = await agentRuleRequest({origin:'https://api.example.com',token:'test',projectId:'demo-01',requestId:'request-1',fetcher:async(url, options)=>{
    assert.equal(options.method,'POST');
    assert.deepEqual(JSON.parse(options.body),{project_id:'demo-01',request_id:'request-1'});
    return {ok:true,json:async()=>({id:'request-1',saved:true})};
  }});
  assert.equal(data.saved,true);
});
test('detail rejects a different property and escapes draft HTML', async () => {
  await assert.rejects(agentRuleRequest({origin:'https://api.example.com',token:'test',projectId:'demo-01',runId:'run-1',fetcher:async()=>({ok:true,json:async()=>({id:'run-1',project_id:'other',draft:'text'})})}), /borrador no válido/);
  assert.equal(draftCard({draft:'<script>alert(1)</script>'}).includes('<script>'),false);
});

test('agent API rejects invalid tenant and pagination before any network request', async () => {
  let calls = 0;
  const fetcher = async () => { calls++; throw Error('network must not be called'); };
  for (const projectId of ['', '../other', 'tenant?other', null, 'a'.repeat(101)]) {
    await assert.rejects(fetchAgentRuns({origin:'https://api.example.com',token:'test',projectId,fetcher}), /copropiedad válida/);
    await assert.rejects(agentRuleRequest({origin:'https://api.example.com',token:'test',projectId,requestId:'req-1',fetcher}), /copropiedad válida/);
  }
  for (const offset of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    await assert.rejects(fetchAgentRuns({origin:'https://api.example.com',token:'test',projectId:'tenant-1',offset,fetcher}), /página del historial/);
  }
  await assert.rejects(agentRuleRequest({origin:'https://api.example.com',token:'test',projectId:'tenant-1',runId:'../other',fetcher}), /identificador del borrador/);
  assert.equal(calls,0);
});

test('readiness requires a scoped authenticated backend attestation', async () => {
  const state = await fetchAgentReadiness({origin:'https://api.example.com', token:'token', projectId:'demo-01', fetcher:async (url,options)=>{
    assert.equal(url.pathname,'/agent-readiness');
    assert.equal(url.searchParams.get('project_id'),'demo-01');
    assert.equal(options.headers.Authorization,'Bearer token');
    assert.equal(options.redirect,'error');
    return {ok:true,status:200,json:async()=>({mode:'qa_rules_only',project_id:'demo-01',
      registry_ready:true,reviews_ready:false,rules_ready:false,models_ready:false})};
  }});
  assert.equal(state.rules_ready,false);
  assert.equal(state.reviews_ready,false);
  assert.equal(Object.isFrozen(state),true);
});

test('missing, cross-property or inconsistent readiness cannot enable actions', async () => {
  for (const data of [
    {mode:'qa_rules_only',project_id:'other',registry_ready:true,reviews_ready:true,rules_ready:true,models_ready:false},
    {mode:'qa_rules_only',project_id:'demo-01',registry_ready:false,reviews_ready:true,rules_ready:true,models_ready:false},
    {mode:'qa_rules_only',project_id:'demo-01',registry_ready:true,reviews_ready:true,rules_ready:true,models_ready:true},
    {mode:'qa_rules_only',project_id:'demo-01',registry_ready:true,reviews_ready:false,rules_ready:true,models_ready:false},
    {mode:'qa_rules_only',project_id:'demo-01',registry_ready:'yes',reviews_ready:true,rules_ready:true,models_ready:false},
  ]) {
    await assert.rejects(fetchAgentReadiness({origin:'https://api.example.com', token:'token',projectId:'demo-01',
      fetcher:async()=>({ok:true,status:200,json:async()=>data})}),/diagnóstico/);
  }
  await assert.rejects(fetchAgentReadiness({origin:'https://api.example.com', token:'token',projectId:'demo-01',
    fetcher:async()=>({ok:false,status:403})}),/MFA AAL2/);
  let calls=0;
  await assert.rejects(fetchAgentReadiness({origin:'https://api.example.com', token:'token',projectId:'../other',
    fetcher:async()=>{calls++; throw Error('No network expected');}}),/copropiedad válida/);
  assert.equal(calls,0);
});

test('the agent UI never offers writes without live QA registry and human review', async () => {
  const makeContainer=()=>({innerHTML:'',isConnected:true,addEventListener(){}});
  const baseRepo={agentApiConfigured:true,agentRuns:async()=>[],
    runAgentRules:async()=>({}),reviewAgentRun:async()=>({})};
  let container=makeContainer();
  await mountAgentHistory(container,{repo:{...baseRepo,
    agentReadiness:async()=>({registry_ready:false,reviews_ready:false,rules_ready:false})},
    projectId:'demo-01',role:'admin'});
  assert.doesNotMatch(container.innerHTML,/data-history="(?:run|approve|reject)"/);
  assert.match(container.innerHTML,/registro de ejecuciones/i);

  container=makeContainer();
  await mountAgentHistory(container,{repo:{...baseRepo,
    agentReadiness:async()=>({registry_ready:true,reviews_ready:false,rules_ready:false})},
    projectId:'demo-01',role:'admin'});
  assert.match(container.innerHTML,/data-history="load"/);
  assert.doesNotMatch(container.innerHTML,/data-history="run"/);
  assert.match(container.innerHTML,/Las aprobaciones todavía no están disponibles/);

  container=makeContainer();
  await mountAgentHistory(container,{repo:{...baseRepo,
    agentReadiness:async()=>{throw Error('Backend not connected');}},
    projectId:'demo-01',role:'admin'});
  assert.doesNotMatch(container.innerHTML,/data-history="run"/);
  assert.match(container.innerHTML,/No se verificó la preparación/);
});

test('read-only Worker detail GET carries explicit tenant scope', async () => {
  const id='12345678-1234-4123-8123-123456789abc';
  const value=await agentRuleRequest({origin:'https://example.com',token:'synthetic',
    projectId:'demo-01',runId:id,fetcher:async(url,options)=>{
      assert.equal(url.pathname,'/agent-runs/'+id);
      assert.equal(url.searchParams.get('project_id'),'demo-01');
      assert.equal(options.method,'GET');
      assert.equal(options.body,undefined);
      return {ok:true,json:async()=>({id,project_id:'demo-01',draft:'Prueba de lectura'})};
    }});
  assert.equal(value.project_id,'demo-01');
});
