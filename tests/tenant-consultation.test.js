import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchTenantSummary } from '../src/js/services/tenant-consultation.js';
const ok = {project_id:'00000000-0000-0000-0000-000000000001',source:'synthetic',agent_access:false,record_count:2,totals:{events:2,pqrs:0,pending:1}};
const response = (payload, status=200) => ({status, ok:status >= 200 && status < 300, json:async()=>payload});
const run = (fetcher, projectId='00000000-0000-0000-0000-000000000001', token='synthetic-token') => fetchTenantSummary({origin:'https://qa.invalid/',token,projectId,fetcher});
test('synthetic tenant summary is accepted',async()=> {
 const d=await run(async (url,opts) => {
  assert.equal(url.searchParams.get('project_id'),'00000000-0000-0000-0000-000000000001');
  assert.equal(opts.method,'GET');
  assert.equal(opts.cache,'no-store');
  assert.equal(opts.credentials,'omit');
  assert.equal(opts.headers.Authorization,'Bearer synthetic-token');
  return response(ok);
 });assert.deepEqual(d,ok);
});
test('cross-tenant response is rejected',async()=>assert.rejects(run(async()=>response({...ok,project_id:'00000000-0000-0000-0000-000000000002'}))));
test('real source is rejected',async()=>assert.rejects(run(async()=>response({...ok,source:'real'}))));
test('agent enabled response is rejected',async()=>assert.rejects(run(async()=>response({...ok,agent_access:true}))));
test('invalid totals are rejected',async()=>assert.rejects(run(async()=>response({...ok,record_count:3}))));
test('invalid project id is rejected before fetch',async()=>assert.rejects(run(async()=>{throw Error('should not fetch')},'00000000-0000-0000-0000-000000000001&project_id=00000000-0000-0000-0000-000000000002')));
test('missing JWT denied before fetch',async()=>assert.rejects(run(async()=>{throw Error('should not fetch')},'00000000-0000-0000-0000-000000000001','')));
test('403 is not converted to empty results',async()=>assert.rejects(run(async()=>response({},403))));
test('503 stays blocked',async()=>assert.rejects(run(async()=>response({},503))));
test('401 requires authentication',async()=>assert.rejects(run(async()=>response({},401))));
