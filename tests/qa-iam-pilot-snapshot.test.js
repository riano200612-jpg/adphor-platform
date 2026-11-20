import test from 'node:test';
import assert from 'node:assert/strict';
import {auditPilotIamSnapshot} from '../src/js/services/qa-iam-pilot-snapshot.js';
const property=(id,legacyId)=>({projectId:id,legacyDelegateId:legacyId});
const delegate=(id,overrides={})=>({legacyId:id,status:'Activo',role:'D',...overrides});
const account=(id,mail)=>({email:mail,user_id:'uid-'+id,status:'active'});
const identity=(id,mail,overrides={})=>({legacyId:id,userId:'uid-'+id,email:mail,
 ownerApproved:true,emailConfirmed:true,mfaFactorVerified:true,...overrides});
const directory=(projectId,id)=>({projectId,legacyDelegateId:id,userId:'uid-'+id,reviewed:true});
const grant=(projectId,mail,role='admin')=>({project_id:projectId,email:mail,role});
const fixture=()=>({
 properties:[property('b1','d1'),property('b2','d1')],delegates:[delegate('d1')],
 directory:[directory('b1','d1'),directory('b2','d1')],
 approvedIdentityLinks:[identity('d1','personal@example.invalid')],
 iamAccounts:[account('d1','personal@example.invalid')],
 iamGrants:[grant('b1','personal@example.invalid'),grant('b2','personal@example.invalid')]
});
test('real email-keyed grants are reconciled to one individual UUID across two buildings',()=>{
 const r=auditPilotIamSnapshot(fixture());
 assert.equal(r.readyToTest,2);assert.equal(r.totalProperties,2);
 assert.equal(r.outOfScopeGrants,0);assert.equal(r.canProvision,false);
 assert.equal(r.canSendInvitations,false);assert.equal(r.certified,false);
 assert.doesNotMatch(JSON.stringify(r),/personal@|uid-d1/);
});
test('zero IAM grants is never mistaken for operational access',()=>{
 const r=auditPilotIamSnapshot({...fixture(),iamGrants:[]});
 assert.equal(r.readyToTest,0);assert.equal(r.counts.GRANT_PENDING,2);
});
test('an unverified address or identity link cannot be promoted by a legacy shared contact',()=>{
 const f=fixture();f.approvedIdentityLinks=[identity('d1','personal@example.invalid',{ownerApproved:false})];
 const r=auditPilotIamSnapshot(f);assert.equal(r.readyToTest,0);
 assert.equal(r.counts.LOGIN_EMAIL_UNVERIFIED,2);
});
test('mfa, email confirmation and account status must all be individually verified',()=>{
 for(const link of [{mfaFactorVerified:false},{emailConfirmed:false}]){
  const f=fixture();f.approvedIdentityLinks=[identity('d1','personal@example.invalid',link)];
  assert.equal(auditPilotIamSnapshot(f).readyToTest,0);
 }
 const f=fixture();f.iamAccounts=[{...f.iamAccounts[0],status:'suspended'}];
 assert.equal(auditPilotIamSnapshot(f).readyToTest,0);
});
test('unreviewed property mapping and coordinator role do not grant access',()=>{
 const f=fixture();f.directory=[{...directory('b1','d1'),reviewed:false},directory('b2','d1')];
 assert.equal(auditPilotIamSnapshot(f).readyToTest,1);
 const f2=fixture();f2.delegates=[delegate('d1',{role:'Coordinadora'})];
 assert.equal(auditPilotIamSnapshot(f2).readyToTest,0);
});
test('extra IAM grant to unassigned property blocks overall readiness',()=>{
 const f=fixture();f.iamGrants.push(grant('foreign','personal@example.invalid'));
 const r=auditPilotIamSnapshot(f);assert.equal(r.outOfScopeGrants,1);
 assert.equal(r.readyToTest,0);
});
test('unmatched email-keyed grant and duplicate IAM account fail closed',()=>{
 const f=fixture();f.iamGrants.push(grant('foreign','unknown@example.invalid'));
 const r=auditPilotIamSnapshot(f);assert.equal(r.unmatchedGrants,1);assert.equal(r.readyToTest,0);
 const d=fixture();d.iamAccounts.push(account('d1','PERSONAL@example.invalid'));
 assert.equal(auditPilotIamSnapshot(d).readyToTest,0);
});
test('reusing same identity for distinct people and duplicate approval links blocks overall pilot',()=>{
 const f=fixture();f.properties.push(property('b3','d2'));f.delegates.push(delegate('d2'));
 f.approvedIdentityLinks.push(identity('d2','other@example.invalid',{userId:'uid-d1'}));
 f.directory.push({...directory('b3','d2'),userId:'uid-d1'});
 f.iamAccounts.push(account('d2','other@example.invalid'));
 f.iamGrants.push(grant('b3','other@example.invalid'));
 const r=auditPilotIamSnapshot(f);assert.equal(r.conflictingOwners,1);assert.equal(r.readyToTest,0);
 const d=fixture();d.approvedIdentityLinks.push(identity('d1','personal@example.invalid'));
 assert.equal(auditPilotIamSnapshot(d).readyToTest,0);
});
test('disallow incorrect IAM role and fake matching IDs',()=>{
 const f=fixture();f.iamGrants=[grant('b1','personal@example.invalid','viewer'),grant('b2','personal@example.invalid')];
 assert.equal(auditPilotIamSnapshot(f).readyToTest,1);
 const d=fixture();d.iamAccounts=[{...d.iamAccounts[0],user_id:'another-uuid'}];
 assert.equal(auditPilotIamSnapshot(d).readyToTest,0);
});
test('reject missing or malformed source arrays; never infer from empty inputs',()=>{
 assert.throws(()=>auditPilotIamSnapshot({properties:[],delegates:[]}),/Fuente privada/);
 const f=fixture();f.iamAccounts=null;
 assert.throws(()=>auditPilotIamSnapshot(f),/Fuente privada/);
});
