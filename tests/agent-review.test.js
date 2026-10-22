import test from 'node:test';
import assert from 'node:assert/strict';
import {submitAgentReview} from '../src/js/services/agent-review.js';
import {draftCard} from '../src/js/ui-agent-history.js';
const args = {projectId:'demo-01',runId:'run-1',resultHash:'a'.repeat(64),decision:'approved',note:' Revisado '};
function mock(error = null, override = {}) {
  const calls = [];
  return {calls, from(table) { assert.equal(table,'agent_reviews'); return {insert(payload) {
    calls.push(payload);
    return {select() {return {async single() {return {error, data:{...payload, administrator_id:'human',decided_at:'2026-10-22T14:00:00Z',...override}};}};}};
  }};}};
}
test('review writes only decision fields; actor and timestamp come from database', async () => {
  const client = mock();
  const result = await submitAgentReview(client,{...args,administrator_id:'forged',decided_at:'forged'});
  assert.deepEqual(Object.keys(client.calls[0]).sort(),['decision','note','project_id','result_hash','run_id']);
  assert.equal(client.calls[0].note,'Revisado');
  assert.equal(result.administrator_id,'human');
});
test('invalid decision and oversized notes never reach database', async () => {
  const client=mock();
  await assert.rejects(submitAgentReview(client,{...args,decision:'send'}));
  await assert.rejects(submitAgentReview(client,{...args,note:'x'.repeat(4001)}));
  assert.equal(client.calls.length,0);
});
test('permission and concurrent decision failures do not report success or overwrite', async () => {
  await assert.rejects(submitAgentReview(mock({code:'42501'}),args),/Solo el Administrador/);
  await assert.rejects(submitAgentReview(mock({code:'23505'}),args),/ya tiene una decisión/);
  await assert.rejects(submitAgentReview(mock(null,{project_id:'other'}),args),/verificar/);
});
test('review controls require enabled human review and disappear after decision', () => {
  const item={draft:'Draft',status:'Pending'};
  assert.doesNotMatch(draftCard(item),/data-history="approve"/);
  assert.match(draftCard(item,true),/data-history="approve"/);
  const reviewed=draftCard({...item,decided_at:'2026-10-22T14:00:00Z',note:'<img onerror=alert(1)>'},true);
  assert.doesNotMatch(reviewed,/data-history="approve"/);
  assert.doesNotMatch(reviewed,/<img/);
  assert.match(reviewed,/&lt;img/);
});
