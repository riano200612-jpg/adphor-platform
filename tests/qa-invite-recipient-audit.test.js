import test from 'node:test';
import assert from 'node:assert/strict';
import {auditIndividualInvitationDestinations} from '../src/js/services/qa-invite-recipient-audit.js';
const candidate=(legacyId,legacyEmail,overrides={})=>({
 legacyId,legacyEmail,status:'Activo',role:'D',reviewClassification:'MATCHED',...overrides
});
const property=(projectId,propertyContactEmail)=>({projectId,propertyContactEmail});
const recipient=(legacyId,individualEmail,overrides={})=>({
 legacyId,individualEmail,personVerified:true,mailboxConfirmed:true,ownerApproved:true,...overrides
});
const run=(people,properties,recipients=[])=>
 auditIndividualInvitationDestinations({people,properties,recipients});

test('real-shaped legacy concentration cannot produce ready invitations by itself',()=>{
 const people=Array.from({length:55},(_,i)=>candidate('d'+i,
  i<47?'historic.shared@example.invalid':'historical'+i+'@example.invalid'));
 const buildings=Array.from({length:43},(_,i)=>property('b'+i,'building'+i+'@example.invalid'));
 const r=run(people,buildings);
 assert.equal(r.totalPeople,55);
 assert.equal(r.totalProperties,43);
 assert.equal(r.sharedLegacyUsers,47);
 assert.equal(r.legacyDistinctAddresses,9);
 assert.equal(r.propertyContactDistinctAddresses,43);
 assert.equal(r.readyForPrivateReview,0);
 assert.equal(r.canSend,false);assert.equal(r.canProvision,false);
 assert.doesNotMatch(JSON.stringify(r),/@|historic\.shared|PIN|password/i);
});
test('a separately approved individual mailbox may enter private IAM review, never auto-send',()=>{
 const r=run([candidate('d1','shared@old.invalid'),candidate('d2','shared@old.invalid')],
 [property('b1','operations@building.invalid')],
 [recipient('d1','individual@new.invalid')]);
 assert.equal(r.readyForPrivateReview,1);
 assert.equal(r.reasonCounts.PERSONAL_EMAIL_APPROVAL_MISSING_OR_AMBIGUOUS,1);
 assert.equal(r.canSend,false);
});
test('shared historical source address cannot be reused as individual login even if approved',()=>{
 const r=run([candidate('d1','SHARED@old.invalid'),candidate('d2','shared@OLD.invalid')],
 [property('b1','admin@building.invalid')],
 [recipient('d1','shared@old.invalid')]);
 assert.equal(r.readyForPrivateReview,0);
 assert.equal(r.reasonCounts.LEGACY_SHARED_EMAIL_UNSAFE,1);
});
test('a property contact is not automatically an individual mailbox',()=>{
 const r=run([candidate('d1','shared@old.invalid')],
 [property('b1','admin@property.invalid')],
 [recipient('d1','ADMIN@property.invalid')]);
 assert.equal(r.readyForPrivateReview,0);
 assert.equal(r.reasonCounts.PROPERTY_CONTACT_NOT_PERSONAL,1);
});
test('same individual mailbox for distinct people blocks both even if ownerApproved true',()=>{
 const r=run([candidate('d1','old1@old.invalid'),candidate('d2','old2@old.invalid')],
 [property('b1','building@domain.invalid')],
 [recipient('d1','shared@personal.invalid'),recipient('d2','SHARED@personal.invalid')]);
 assert.equal(r.reasonCounts.PERSONAL_EMAIL_SHARED,2);
 assert.equal(r.readyForPrivateReview,0);
});
test('missing personal proof, mailbox confirmation or owner consent fail closed',()=>{
 for(const bad of [{personVerified:false},{mailboxConfirmed:false},{ownerApproved:false}]){
  const r=run([candidate('d1','old@domain.invalid')],[property('b1','contact@property.invalid')],
    [recipient('d1','individual@unique.invalid',bad)]);
  assert.equal(r.readyForPrivateReview,0);
  assert.equal(r.reasonCounts.IDENTITY_OR_MAILBOX_UNVERIFIED,1);
 }
});
test('blocked and disabled people, wrong roles, unmatched aliases cannot be invited',()=>{
 const r=run([
  candidate('d1','one@old.invalid',{status:'Bloqueado'}),
  candidate('d2','two@old.invalid',{status:'Desactivado'}),
  candidate('d3','three@old.invalid',{role:'CZMC'}),
  candidate('d4','four@old.invalid',{reviewClassification:'ALIAS_REVIEW'})
 ],[property('b1','mail@building.invalid')],[
  recipient('d1','p1@new.invalid'),recipient('d2','p2@new.invalid'),
  recipient('d3','p3@new.invalid'),recipient('d4','p4@new.invalid')
 ]);
 assert.equal(r.readyForPrivateReview,0);
 assert.equal(r.reasonCounts.SOURCE_NOT_ACTIVE,2);
 assert.equal(r.reasonCounts.ROLE_NOT_DELEGATE,1);
 assert.equal(r.reasonCounts.IDENTITY_REVIEW,1);
});
test('unrecognized recipient reference blocks all review candidates globally',()=>{
 const r=run([candidate('d1','old@legacy.invalid')],[property('b1','ops@property.invalid')],
 [recipient('d1','person@new.invalid'),recipient('intruder','unknown@new.invalid')]);
 assert.equal(r.invalidRecipientReferences,1);
 assert.equal(r.readyForPrivateReview,0);
});
test('duplicate original identity, duplicate approved recipient and invalid email fail closed',()=>{
 assert.throws(()=>run([candidate('d1','a@old.invalid'),candidate('d1','b@old.invalid')],
 [property('p1','mail@property.invalid')]),/duplicados/);
 assert.throws(()=>run([candidate('d1','old@legacy.invalid')],[
  property('p1','a@property.invalid'),property('p1','b@property.invalid')]),/duplicados/);
 const r=run([candidate('d1','old@legacy.invalid')],[property('p1','a@property.invalid')],
 [recipient('d1','valid@new.invalid'),recipient('d1','another@new.invalid')]);
 assert.equal(r.reasonCounts.PERSONAL_EMAIL_APPROVAL_MISSING_OR_AMBIGUOUS,1);
 const wrong=run([candidate('d1','old@legacy.invalid')],[property('p1','mail@property.invalid')],
 [recipient('d1','not-an-email')]);
 assert.equal(wrong.reasonCounts.PERSONAL_EMAIL_INVALID,1);
});
test('incomplete source arrays never produce a positive result',()=>{
 assert.throws(()=>auditIndividualInvitationDestinations({people:null,properties:[],recipients:[]}),/incompleta/);
 assert.throws(()=>run([],[property('p1','mail@property.invalid')]),/vacío/);
 assert.throws(()=>run([candidate('d1','old@legacy.invalid')],[]),/vacío/);
});
