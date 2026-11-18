import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizePqrsRouteReadiness} from '../src/js/ui-pqrs-route-readiness.js';
const base={project_id:'source-1',readiness:'PENDING_APPROVAL',issue_code:'CROSS_SOURCE_MATCH',
 candidate_email_present:true,last_reconciled_at:'2026-11-18T15:00:00Z',
 candidate_email:'private@example.invalid',applicant_name:'DO NOT SHOW'};
test('matched sources do not authorize email delivery',()=>{
 const r=normalizePqrsRouteReadiness(base,'source-1');
 assert.equal(r.readiness,'PENDING_APPROVAL');assert.equal(r.emailDeliveryEnabled,false);
});
test('candidate contact and personal fields are never exposed to UI',()=>{
 const r=normalizePqrsRouteReadiness(base,'source-1');
 assert.equal(r.candidate_email,undefined);assert.equal(r.applicant_name,undefined);
 assert.equal(JSON.stringify(r).includes('private@example.invalid'),false);
});
test('every conflict mode is fail closed',()=>{
 for(const readiness of ['CONFLICT','SOURCE_GAP','MISSING_EMAIL']){
  const r=normalizePqrsRouteReadiness({...base,readiness},'source-1');
  assert.equal(r.emailDeliveryEnabled,false);assert.ok(r.detail.length>20);
 }
});
test('cross property result is rejected',()=>{
 assert.throws(()=>normalizePqrsRouteReadiness(base,'source-2'));
});
test('unknown and malformed status do not silently authorize anything',()=>{
 assert.throws(()=>normalizePqrsRouteReadiness({...base,readiness:'APPROVED'},'source-1'));
 assert.throws(()=>normalizePqrsRouteReadiness({...base,candidate_email_present:'true'},'source-1'));
 assert.throws(()=>normalizePqrsRouteReadiness({...base,issue_code:123},'source-1'));
});
test('claims of sent or approved in untrusted response are ignored',()=>{
 const r=normalizePqrsRouteReadiness({...base,approved:true,sent:true,provider_message_id:'fake'},'source-1');
 assert.equal(r.emailDeliveryEnabled,false);
 assert.equal(r.approved,undefined);
 assert.equal(r.sent,undefined);
});
