import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readQaRecovery, createPasswordRecovery} from '../src/js/services/password-recovery.js';

const url = 'https://qfctnnnnltghepwujpdm.supabase.co';
function read(href, backend = url) {
  let cleaned;
  const result = readQaRecovery(new URL(href), {replaceState(_state, _title, path) {cleaned = path;}}, backend);
  return {result, cleaned};
}
const origin = 'https://qa-pqrs-carrusel-integracion.adphor-platform.pages.dev';
const fragment = '#type=recovery&access_token=test-access&refresh_token=test-refresh';
test('recovery removes URL credentials and only accepts isolated QA targets', () => {
  assert.deepEqual(read(origin + fragment), {result: {access_token:'test-access', refresh_token:'test-refresh'}, cleaned:'/'});
  for (const host of ['https://adphor-platform.pages.dev', 'https://evil.example', 'http://qa-pqrs-carrusel-integracion.adphor-platform.pages.dev']) {
    assert.ok(read(host + fragment).result.error);
  }
  assert.ok(read(origin + fragment, 'https://oqizvirqjwbbhyyjpthq.supabase.co').result.error);
  assert.equal(read(origin).result, null);
});
test('expired, partial and non-recovery links never create a session', () => {
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
