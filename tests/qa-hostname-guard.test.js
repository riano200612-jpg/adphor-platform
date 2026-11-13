import test from 'node:test';
import assert from 'node:assert/strict';
import {qaAuthPolicy,applicationRepositoryMode,QA_URL} from '../src/js/services/qa-auth-policy.js';

// Contract hosts are explicit: a renamed alias must not silently lose protection.
const hosts=[
 'qa-pqrs-carrusel-integracion.adphor-platform.pages.dev',
 'qa-integral-claude-reviewed.adphor-platform.pages.dev',
];
for(const hostname of hosts){
 test(`${hostname}: rejects missing, foreign and production backends regardless of MFA flag`,()=>{
  for(const url of [undefined,'','https://other.supabase.co','https://oqizvirqjwbbhyyjpthq.supabase.co',QA_URL+'/']){
   for(const requireMfa of [undefined,'false','true']){
    assert.throws(()=>qaAuthPolicy({hostname,url,requireMfa}),/QA_AUTH_CONFIG_BLOCKED/);
    assert.equal(applicationRepositoryMode({hostname,url,key:'synthetic-public-key'}),'blocked');
   }
  }
 });
 test(`${hostname}: missing key and readonly/demo fallback fail closed`,()=>{
  for(const key of [undefined,null,''])assert.equal(applicationRepositoryMode({hostname,url:QA_URL,key}),'blocked');
  assert.equal(applicationRepositoryMode({hostname,url:QA_URL,key:'synthetic-public-key',readonly:true}),'blocked');
  assert.equal(applicationRepositoryMode({hostname}),'blocked');
 });
 test(`${hostname}: valid QA remains cloud-backed with mandatory MFA`,()=>{
  for(const requireMfa of [undefined,'false','true'])assert.deepEqual(qaAuthPolicy({hostname,url:QA_URL,requireMfa}),{required:true,isolatedQa:true});
  assert.equal(applicationRepositoryMode({hostname,url:QA_URL,key:'synthetic-public-key'}),'cloud');
 });
}
test('production configuration and explicit localhost demo keep their existing behavior',()=>{
 const production={hostname:'adphor-platform.pages.dev',url:'https://oqizvirqjwbbhyyjpthq.supabase.co',key:'synthetic-public-key'};
 assert.equal(applicationRepositoryMode(production),'cloud');
 assert.deepEqual(qaAuthPolicy({...production,requireMfa:'false'}),{required:false,isolatedQa:false});
 assert.equal(applicationRepositoryMode({hostname:'localhost'}),'demo');
});
