import test from 'node:test';
import assert from 'node:assert/strict';
import {visitDraftGuidance, visitContentKey, createVisitReviewState} from '../src/js/ui-visit-preparation.js';

test('visit preparation requires property, motive, date and scoped responsible', () => {
  const draft={projectId:'p1',kind:'Inspección',start:'2026-11-13T10:00',responsibleId:'u1',allowedResponsibleIds:['u1']};
  assert.match(visitDraftGuidance({...draft,projectId:''}),/copropiedad asignada/);
  assert.match(visitDraftGuidance({...draft,kind:' '}),/motivo/);
  assert.match(visitDraftGuidance({...draft,start:''}),/fecha/);
  assert.match(visitDraftGuidance({...draft,responsibleId:'other'}),/responsable autorizado/);
  assert.match(visitDraftGuidance(draft),/SQL aún no está habilitado/);
});

const content = {projectId:'p1',kind:' Inspección ',start:'2026-11-13T10:00',responsibleId:'u1'};
test('visit content identity normalizes motive and separates property and responsible', () => {
 assert.equal(visitContentKey(content),visitContentKey({...content,kind:'Inspección'}));
 for(const delta of [{projectId:'p2'},{responsibleId:'u2'},{start:'2026-11-13T11:00'},{kind:'Otro'}])
  assert.notEqual(visitContentKey(content),visitContentKey({...content,...delta}));
});
test('confirmed save then edit revert review cannot create another request', () => {
 let ids=0;const state=createVisitReviewState(()=>String(++ids));
 const first=state.review(content);state.confirmed(first);state.invalidate();
 state.review({...content,kind:'Otro'});state.invalidate();
 assert.equal(state.review(content),undefined);assert.equal(state.current(),undefined);
 assert.equal(ids,2);
});
test('SQL error or lost response then edit revert review retains request identity', async () => {
 let ids=0;const state=createVisitReviewState(()=>String(++ids));
 const sent=[];const save=async request=>{sent.push(request.requestId);throw Error('SQL unavailable');};
 const first=state.review(content);await assert.rejects(save(first));
 assert.equal(state.current(),first);assert.equal(state.review(content),first);
 state.invalidate();assert.equal(state.current(),undefined);
 state.review({...content,kind:'Otro'});state.invalidate();
 const retry=state.review(content);assert.equal(retry.requestId,first.requestId);
 await assert.rejects(save(retry));assert.deepEqual(sent,['1','1']);
 state.confirmed(retry);assert.equal(state.review(content),undefined);
});
