import test from 'node:test';
import assert from 'node:assert/strict';
import { authorizeSensitiveEffect } from '../qa/security/agent-effect-contract.js';

const actor = { kind:'human', id:'admin-qa', role:'admin', mfaVerified:true };
const review = { decision:'approved', projectId:'p1', runId:'r1', fingerprint:'sha256-qa', administratorId:'admin-qa' };
const payload = { actor, action:'close-ticket', review, projectId:'p1', runId:'r1', fingerprint:'sha256-qa' };

test('agents and service identities cannot perform sensitive effects even with a valid review',()=>{
  for(const kind of ['agent','service','worker','anonymous']){
    assert.equal(authorizeSensitiveEffect({...payload,actor:{...actor,kind}}).allowed,false);
  }
});
test('MFA, administrator and identity required',()=>{
  for(const a of [{...actor,mfaVerified:false},{...actor,role:'technician'},{...actor,id:''},null]){
    assert.equal(authorizeSensitiveEffect({...payload,actor:a}).allowed,false);
  }
});
test('review must match exact execution, project, fingerprint and administrator',()=>{
  for(const field of ['projectId','runId','fingerprint','administratorId','decision']){
    const value = field==='decision'?'rejected':'wrong';
    assert.equal(authorizeSensitiveEffect({...payload,review:{...review,[field]:value}}).allowed,false);
  }
});
test('no effects without an explicit review or recognized action',()=>{
  assert.equal(authorizeSensitiveEffect({...payload,review:null}).allowed,false);
  assert.equal(authorizeSensitiveEffect({...payload,action:'delete-database'}).allowed,false);
});
test('approval contract only authorizes additional server-side validation, not execution',()=>{
  const result=authorizeSensitiveEffect(payload);
  assert.deepEqual(result,{allowed:true,reason:'requires_server_side_revalidation'});
});
