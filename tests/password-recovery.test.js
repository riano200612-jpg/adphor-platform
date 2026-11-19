import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readQaRecovery, createPasswordRecovery} from '../src/js/services/password-recovery.js';

const url = 'https://qfctnnnnltghepwujpdm.supabase.co';
function read(href, backend = url) {
  let cleaned;
  const result = readQaRecovery(new URL(href), {replaceState(_state, _title, path) {cleaned = path;}}, backend);
  return {result, cleaned};
}
const origin = 'https://qa-integral-claude-reviewed.adphor-platform.pages.dev';
const fragment = '#type=recovery&access_token=test-access&refresh_token=test-refresh';
test('recovery removes URL credentials and only accepts isolated QA targets', () => {
  assert.deepEqual(read(origin + fragment), {result: {access_token:'test-access', refresh_token:'test-refresh',purpose:'recovery'}, cleaned:'/'});
  for (const host of ['https://adphor-platform.pages.dev', 'https://evil.example', 'http://qa-integral-claude-reviewed.adphor-platform.pages.dev', 'https://qa-pqrs-carrusel-integracion.adphor-platform.pages.dev']) {
    assert.ok(read(host + fragment).result.error);
  }
  assert.ok(read('https://a3abd4f9.adphor-platform.pages.dev'+fragment).result.error);
  assert.ok(read(origin + fragment, 'https://oqizvirqjwbbhyyjpthq.supabase.co').result.error);
  assert.equal(read(origin).result, null);
});
test('official invitation fragments use the isolated password setup flow', () => {
  const invite = fragment.replace('recovery', 'invite');
  assert.deepEqual(read(origin + invite),{
    result:{access_token:'test-access',refresh_token:'test-refresh',purpose:'invite'},cleaned:'/'
  });
  assert.notDeepEqual(read(origin + invite),read(origin + fragment));
  assert.ok(read('https://adphor-platform.pages.dev' + invite).result.error);
  assert.ok(read(origin + '#type=invite&access_token=x').result.error);
});
test('expired, partial and unrelated links never create a session', () => {
  for (const hash of ['#error=access_denied&error_code=otp_expired', '#type=recovery&access_token=x', '#access_token=x&refresh_token=y&type=signup']) {
    const checked = read(origin + hash);
    assert.ok(checked.result.error); assert.equal(checked.cleaned, '/');
  }
});
test('invalid link cannot update a password', async () => {
  let updates = 0;
  await assert.rejects(createPasswordRecovery({setSession:async()=>({error:{}}), updateUser:async()=>{updates++;}}, {}));
  assert.equal(updates, 0);
});
test('verified recovery validates confirmation, updates once, signs out, never loads app data', async () => {
  const calls = [];
  const auth = {
    setSession: async () => {calls.push('session'); return {error:null};},
    getUser: async () => {calls.push('verify'); return {data:{user:{id:'existing-user'}},error:null};},
    updateUser: async fields => {assert.deepEqual(fields,{password:'a-long-test-password'});calls.push('update');return {error:null};},
    signOut: async () => {calls.push('signout');return {error:null};},
  };
  const recovery = await createPasswordRecovery(auth, {});
  await assert.rejects(recovery.update('short','short'));
  await assert.rejects(recovery.update('a-long-test-password','different'));
  assert.deepEqual(await recovery.update('a-long-test-password','a-long-test-password'), {signedOut:true});
  await assert.rejects(recovery.update('a-long-test-password','a-long-test-password'));
  assert.deepEqual(calls, ['session','verify','update','signout']);
});

test('first-access invitation purpose is not inferred from user supplied query string',()=>{
 const forged=read(origin+'?type=invite'+fragment);
 assert.equal(forged.result.purpose,'recovery');
 assert.equal(forged.cleaned,'/');
 const malicious=read(origin+'#type=signup&access_token=x&refresh_token=y');
 assert.ok(malicious.result.error);
});
test('invitation temporary password session never loads operational data or enrolls MFA',async()=>{
 const calls=[];
 const auth={
  setSession:async tokens=>{assert.deepEqual(Object.keys(tokens).sort(),['access_token','refresh_token']);calls.push('session');return {error:null};},
  getUser:async()=>{calls.push('verify');return {data:{user:{id:'synthetic-invite'}}};},
  updateUser:async({password})=>{calls.push('set-password');assert.equal(password,'long-qa-invitation-123');return {error:null};},
  signOut:async()=>{calls.push('signout');return {error:null};}
 };
 const temp=await createPasswordRecovery(auth,{
  access_token:'synthetic-only',refresh_token:'synthetic-only',purpose:'invite'
 });
 assert.deepEqual(await temp.update('long-qa-invitation-123','long-qa-invitation-123'),{signedOut:true});
 assert.deepEqual(calls,['session','verify','set-password','signout']);
 await assert.rejects(temp.update('another-secret-123','another-secret-123'));
});
