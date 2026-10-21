import test from 'node:test';
import assert from 'node:assert/strict';
import { agentApiOrigin, fetchAgentRuns } from '../src/js/services/agent-api.js';
import { historyCards } from '../src/js/ui-agent-history.js';

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
