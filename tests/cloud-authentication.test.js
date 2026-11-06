import test from 'node:test';
import assert from 'node:assert/strict';
import {createCloudAuthentication} from '../src/js/services/cloud-authentication.js';
import {qaAuthPolicy,assertQaBuildAuth,QA_REF,QA_URL,QA_HOST} from '../src/js/services/qa-auth-policy.js';

function fixture({factors=[],challengeLevel='aal2',profileError=false}={}) {
  const calls=[];let level='aal1';
  const auth={
    signInWithPassword:async()=>{calls.push('password');return {data:{user:{id:'owner'}}};},
    getUser:async()=>({data:{user:{id:'owner'}}}),
    signOut:async()=>{calls.push('logout');return {data:{}};},
    mfa:{
      listFactors:async()=>({data:{all:factors}}),
      enroll:async()=>{calls.push('enroll');return {data:{id:'totp-new',totp:{qr_code:'<svg/>',secret:'SYNTHETIC'}}};},
      challengeAndVerify:async()=>{calls.push('verify');level=challengeLevel;return {data:{}};},
      getAuthenticatorAssuranceLevel:async()=>({data:{currentLevel:level}}),
    }
  };
  const client={auth,from:table=>{
    calls.push(table);
    return {select:()=>({eq:()=>({single:async()=>profileError?{error:{message:'Cannot coerce the result to a single JSON object'}}:{data:{name:'Owner'}}})})};
  }};
  const policy=qaAuthPolicy({url:QA_URL,requireMfa:'false',hostname:QA_HOST});
  return {calls,auth,flow:createCloudAuthentication(client,{required:policy.required,allowEnrollment:policy.isolatedQa})};
}

test('known QA requires MFA even when its optional flag is absent or false',()=>{
  for(const flag of [undefined,'false',' true ',''])assert.equal(qaAuthPolicy({url:QA_URL,requireMfa:flag}).required,true);
  assert.throws(()=>qaAuthPolicy({url:'https://other.supabase.co',hostname:QA_HOST}),/QA_AUTH_CONFIG_BLOCKED/);
  assert.equal(qaAuthPolicy({url:'https://oqizvirqjwbbhyyjpthq.supabase.co',requireMfa:'false'}).required,false);
});
test('QA build rejects every missing or mismatched security flag',()=>{
  const env={VITE_SUPABASE_URL:QA_URL,VITE_REQUIRE_MFA:'true',VITE_PORTO_QA_ENABLED:'true',VITE_PORTO_STAGING_REF:QA_REF};
  assert.doesNotThrow(()=>assertQaBuildAuth(env));
  for(const key of Object.keys(env))assert.throws(()=>assertQaBuildAuth({...env,[key]:''}),/QA_AUTH_CONFIG_BLOCKED/);
});
test('first login enrolls and verifies TOTP before reading the protected profile',async()=>{
  const f=fixture();
  assert.deepEqual(await f.flow.login({email:'owner@example.invalid',password:'synthetic'}),{mfaRequired:true,enrollmentRequired:true});
  assert.deepEqual(f.calls,['password']);
  await f.flow.enrollMfa();assert.deepEqual(f.calls,['password','enroll']);
  assert.deepEqual(await f.flow.completeMfa('123456'),{id:'owner',name:'Owner'});
  assert.deepEqual(f.calls,['password','enroll','verify','profiles']);
});
test('existing verified factor still requires challenge before the profile',async()=>{
  const f=fixture({factors:[{id:'totp-existing',status:'verified',factor_type:'totp'}]});
  assert.deepEqual(await f.flow.login({email:'owner@example.invalid',password:'synthetic'}),{mfaRequired:true,enrollmentRequired:false});
  assert.equal(f.calls.includes('profiles'),false);
  await f.flow.completeMfa('123456');assert.deepEqual(f.calls,['password','verify','profiles']);
});
test('invalid TOTP and AAL1 response never issue a profile query',async()=>{
  const f=fixture({challengeLevel:'aal1'});
  await f.flow.login({email:'owner@example.invalid',password:'synthetic'});await f.flow.enrollMfa();
  await assert.rejects(f.flow.completeMfa(''),/seis dígitos/);
  await assert.rejects(f.flow.completeMfa('123456'),/no se completó/);
  assert.equal(f.calls.includes('profiles'),false);
});
test('AAL2 drift at profile boundary is denied before issuing its query',async()=>{
  const f=fixture();await f.flow.login({email:'owner@example.invalid',password:'synthetic'});await f.flow.enrollMfa();
  let checks=0;f.auth.mfa.getAuthenticatorAssuranceLevel=async()=>({data:{currentLevel:++checks===1?'aal2':'aal1'}});
  await assert.rejects(f.flow.completeMfa('123456'),/antes de acceder al perfil/);
  assert.equal(f.calls.includes('profiles'),false);
});
test('profile failure after MFA reports authorization, not password failure',async()=>{
  const f=fixture({profileError:true});await f.flow.login({email:'owner@example.invalid',password:'synthetic'});await f.flow.enrollMfa();
  await assert.rejects(f.flow.completeMfa('123456'),/perfil autorizado/);
});
