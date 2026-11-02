import test from 'node:test';
import assert from 'node:assert/strict';
import {createManagedMfa} from '../src/js/services/managed-mfa.js';

const authWithFactors=(all)=>({
 mfa:{listFactors:async()=>({data:{all}}),challengeAndVerify:async()=>({data:{}}),getAuthenticatorAssuranceLevel:async()=>({data:{currentLevel:'aal2'}})},
 getUser:async()=>({data:{user:{id:'delegate-qa'}}})
});
test('mandatory MFA rejects login when no verified factor exists',async()=>{
 const m=createManagedMfa(authWithFactors([]),{required:true});
 await assert.rejects(m.begin('delegate-qa'),/requiere MFA/);
});
test('optional MFA preserves existing enrollment workflow',async()=>{
 const m=createManagedMfa(authWithFactors([]));
 assert.equal(await m.begin('delegate-qa'),false);
});
test('mandatory MFA still requires challenge for verified TOTP',async()=>{
 const m=createManagedMfa(authWithFactors([{id:'f1',status:'verified',factor_type:'totp'}]),{required:true});
 assert.equal(await m.begin('delegate-qa'),true);
 assert.equal(await m.complete('123456'),'delegate-qa');
});
test('unsupported MFA factor is rejected rather than bypassed',async()=>{
 const m=createManagedMfa(authWithFactors([{id:'f1',status:'verified',factor_type:'phone'}]),{required:true});
 await assert.rejects(m.begin('delegate-qa'),/factor configurado/);
});