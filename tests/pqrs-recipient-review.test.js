import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeRecipientReview} from '../src/js/ui-pqrs-recipient-review.js';
const route={project_id:'source-1',readiness:'PENDING_APPROVAL',last_reconciled_at:'2026-11-18T15:00:00Z',
 candidate_email:'hidden@example.invalid'};
const pending={id:'95033210-6568-4915-ac33-b114d2ce9c4b',project_id:'source-1',status:'PENDING',
 requested_at:'2026-11-18T15:01:00Z',source_reconciled_at:'2026-11-18T15:00:00Z',
 recipient_email:'hidden@example.invalid'};
test('matching route allows only request, not delivery',()=>{
 const r=normalizeRecipientReview(route,[],'source-1');
 assert.equal(r.readyForReview,true);assert.equal(r.deliveryAuthorized,false);assert.equal(r.pending,false);
});
test('pending review blocks duplicate action and cannot approve mail',()=>{
 const r=normalizeRecipientReview(route,[pending],'source-1');
 assert.equal(r.readyForReview,false);assert.equal(r.pending,true);assert.equal(r.deliveryAuthorized,false);
});
test('changed source invalidates pending review state',()=>{
 const r=normalizeRecipientReview({...route,last_reconciled_at:'2026-11-18T17:00:00Z'},[pending],'source-1');
 assert.equal(r.stale,true);assert.equal(r.readyForReview,false);
});
test('conflicting, absent and missing-email routes cannot request',()=>{
 for(const readiness of ['CONFLICT','SOURCE_GAP','MISSING_EMAIL']){
  const r=normalizeRecipientReview({...route,readiness},[],'source-1');
  assert.equal(r.readyForReview,false);
 }
});
test('other property, bad statuses, duplicated rows rejected',()=>{
 assert.throws(()=>normalizeRecipientReview(route,[],'source-2'));
 assert.throws(()=>normalizeRecipientReview(route,[{...pending,project_id:'source-2'}],'source-1'));
 assert.throws(()=>normalizeRecipientReview(route,[pending,pending],'source-1'));
 assert.throws(()=>normalizeRecipientReview(route,[{...pending,status:'APPROVED'}],'source-1'));
});
test('PII and privileged approval flags ignored',()=>{
 const r=normalizeRecipientReview({...route,approved:true},[{...pending,approved:true,delivery_enabled:true}],'source-1');
 assert.equal(r.recipient_email,undefined);assert.equal(r.candidate_email,undefined);
 assert.equal(r.approved,undefined);assert.equal(r.deliveryAuthorized,false);
 assert.equal(JSON.stringify(r).includes('hidden@example.invalid'),false);
});
test('dates and request identifiers must be valid',()=>{
 assert.throws(()=>normalizeRecipientReview({...route,last_reconciled_at:'no'},[],'source-1'));
 assert.throws(()=>normalizeRecipientReview(route,[{...pending,id:'not-a-uuid'}],'source-1'));
 assert.throws(()=>normalizeRecipientReview(route,[{...pending,source_reconciled_at:'bad'}],'source-1'));
});

test('requester can cancel but cannot reject their own pending review',()=>{
 const result=normalizeRecipientReview(route,[{...pending,is_mine:true}],'source-1');
 assert.equal(result.canCancel,true);assert.equal(result.canReject,false);
 assert.equal(result.deliveryAuthorized,false);
});
test('different reviewer can reject but not cancel pending request',()=>{
 const result=normalizeRecipientReview(route,[{...pending,is_mine:false}],'source-1');
 assert.equal(result.canCancel,false);assert.equal(result.canReject,true);
 assert.equal(result.deliveryAuthorized,false);
});
test('no pending request means no cancellation or rejection',()=>{
 const result=normalizeRecipientReview(route,[],'source-1');
 assert.equal(result.canCancel,false);assert.equal(result.canReject,false);
});
test('malformed identity marker fails closed',()=>{
 assert.throws(()=>normalizeRecipientReview(route,[{...pending,is_mine:'true'}],'source-1'));
});
