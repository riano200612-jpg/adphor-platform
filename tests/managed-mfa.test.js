import test from 'node:test';import assert from 'node:assert/strict';
import {createManagedMfa} from '../src/js/services/managed-mfa.js';
function setup({error=null,level='aal2',id='qa-user'}={}){
 let calls=0;const auth={getUser:async()=>({data:{user:{id}}}),mfa:{
 listFactors:async()=>({data:{all:[{id:'factor-qa',factor_type:'totp',status:'verified'}]}}),
 challengeAndVerify:async()=>{calls++;return {data:{},error};},
 getAuthenticatorAssuranceLevel:async()=>({data:{currentLevel:level}})}};
 return{mfa:createManagedMfa(auth),auth,calls:()=>calls};
}
test('empty and malformed codes never reach provider',async()=>{
 const f=setup();await f.mfa.begin('qa-user');
 for(const code of ['', ' ', '123', '1234567', null, '12x456'])await assert.rejects(f.mfa.complete(code));
 assert.equal(f.calls(),0);
});
test('successful managed verification is consumed once',async()=>{
 const f=setup();await f.mfa.begin('qa-user');assert.equal(await f.mfa.complete('123456'),'qa-user');
 await assert.rejects(f.mfa.complete('123456'));assert.equal(f.calls(),1);
});
for(const reason of ['expired','incorrect','reused'])test(`provider ${reason} response is rejected`,async()=>{
 const f=setup({error:{message:reason}});await f.mfa.begin('qa-user');await assert.rejects(f.mfa.complete('123456'));
});
test('aal1 response cannot complete login',async()=>{const f=setup({level:'aal1'});await f.mfa.begin('qa-user');await assert.rejects(f.mfa.complete('123456'));});
test('session switch cannot verify another user',async()=>{const f=setup({id:'qa-other'});await f.mfa.begin('qa-user');await assert.rejects(f.mfa.complete('123456'));assert.equal(f.calls(),0);});
test('no enrollment or reset for users without factors',async()=>{const f=setup();f.auth.mfa.listFactors=async()=>({data:{all:[]}});assert.equal(await f.mfa.begin('qa-user'),false);await assert.rejects(f.mfa.complete('123456'));});
