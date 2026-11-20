import test from 'node:test';
import assert from 'node:assert/strict';
import {auditPilotReadiness} from '../src/js/services/qa-pilot-readiness.js';

const delegate=(id, overrides={})=>({
 legacyId:id, status:'Activo',role:'Delegada', userId:'user-'+id,
 loginEmail:id+'@example.invalid',loginEmailVerified:true,...overrides
});
const prop=(id,legacyDelegateId)=>({projectId:id,legacyDelegateId});
const link=(projectId,legacyDelegateId)=>({
 projectId,legacyDelegateId,userId:'user-'+legacyDelegateId
});
const grant=(projectId,legacyDelegateId)=>({
 projectId,userId:'user-'+legacyDelegateId,role:'delegada'
});
const run=(properties,delegates,directory=[],grants=[]) =>
 auditPilotReadiness({properties,delegates,directory,grants});

test('43 properties can be audited without creating accounts, exposing emails or grants',()=>{
 const properties=Array.from({length:43},(_,i)=>prop('p-'+i,'d-'+i));
 const delegates=Array.from({length:43},(_,i)=>delegate('d-'+i));
 const directory=properties.map(p=>link(p.projectId,p.legacyDelegateId));
 const grants=properties.map(p=>grant(p.projectId,p.legacyDelegateId));
 const r=run(properties,delegates,directory,grants);
 assert.equal(r.totalProperties,43);
 assert.equal(r.readyToTest,43);
 assert.equal(r.canProvision,false);
 assert.equal(r.certified,false);
 assert.equal(r.outOfScopeGrants,0);
 assert.doesNotMatch(JSON.stringify(r),/@|user-|password|pin|otp/i);
 assert.equal(Object.isFrozen(r),true);
});
test('one verified delegate may have two buildings on one account, not two accounts',()=>{
 const r=run([prop('a','d1'),prop('b','d1')],[delegate('d1')],
 [link('a','d1'),link('b','d1')],[grant('a','d1'),grant('b','d1')]);
 assert.equal(r.readyToTest,2);
});
test('blocked, inactive, other roles and missing delegates must never gain readiness',()=>{
 const r=run([prop('a','d1'),prop('b','d2'),prop('c','d3'),prop('d','')],
 [delegate('d1',{status:'Bloqueado'}),delegate('d2',{status:'Desactivado'}),
 delegate('d3',{role:'Coordinadora'})],
 [link('a','d1'),link('b','d2'),link('c','d3')],
 [grant('a','d1'),grant('b','d2'),grant('c','d3')]);
 assert.deepEqual(r.entries.map(x=>x.status),
 ['SOURCE_BLOCKED','SOURCE_INACTIVE','ROLE_REVIEW_REQUIRED','MISSING_DELEGATE']);
 assert.equal(r.readyToTest,0);
});
test('duplicate individual login address fails closed, even with matching directory',()=>{
 const r=run([prop('a','d1'),prop('b','d2')],
 [delegate('d1',{loginEmail:'SHARED@example.invalid'}),
  delegate('d2',{loginEmail:' shared@EXAMPLE.INVALID '})],
 [link('a','d1'),link('b','d2')],[grant('a','d1'),grant('b','d2')]);
 assert.equal(r.counts.SHARED_OR_MISSING_LOGIN_EMAIL,2);
 assert.equal(r.readyToTest,0);
});
test('unverified login identity, absent grant, foreign grant, wrong link and duplicates block',()=>{
 const r=run([prop('a','d1'),prop('b','d2'),prop('c','d3'),prop('d','d4')],
 [delegate('d1',{loginEmailVerified:false}),delegate('d2'),
  delegate('d3'),delegate('d4')],
 [link('a','d1'),link('b','d2'),{projectId:'c',userId:'wrong'},
  link('d','d4')], [grant('a','d1'),grant('c','d3'),
  {...grant('d','d4'),role:'coordinator'}]);
 assert.deepEqual(r.entries.map(x=>x.status),[
  'LOGIN_EMAIL_UNVERIFIED','GRANT_PENDING','DIRECTORY_NOT_RECONCILED',
  'GRANT_REVIEW_REQUIRED']);
 assert.equal(r.readyToTest,0);
});
test('unexpected IAM grant outside original assignments is reported, not normalized into access',()=>{
 const r=run([prop('a','d1')],[delegate('d1')],[link('a','d1')],
 [grant('a','d1'),{projectId:'other',userId:'user-d1',role:'admin'}]);
 assert.equal(r.readyToTest,1);
 assert.equal(r.outOfScopeGrants,1);
 assert.equal(r.certified,false);
});
test('incomplete or ambiguous source inventory is rejected',()=>{
 assert.throws(()=>run([prop('a','d1'),prop('a','d1')],[delegate('d1')]),/duplicado/);
 assert.throws(()=>run([],[delegate('d1')]),/duplicado/);
 assert.throws(()=>auditPilotReadiness({properties:null,delegates:[]}),/inválida/);
 assert.throws(()=>run([null],[]),/Registro inválido/);
 const r=run([prop('a','d1')],[delegate('d1'),delegate('d1')]);
 assert.equal(r.entries[0].status,'IDENTITY_REVIEW_REQUIRED');
});
