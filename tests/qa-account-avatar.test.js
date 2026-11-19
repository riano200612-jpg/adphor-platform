import test from 'node:test';
import assert from 'node:assert/strict';
import {
 ACCOUNT_AVATAR_BUCKET,accountAvatarEnabled,accountAvatarPath,
 validateAvatarInput,validateWebpAvatar,createQaAccountAvatarRepository
} from '../src/js/services/qa-account-avatar.js';
import {QA_URL,QA_INTEGRAL_HOST} from '../src/js/services/qa-auth-policy.js';

const owner='11111111-1111-4111-8111-111111111111';
const other='22222222-2222-4222-8222-222222222222';
function fixture(){
 const calls=[];let actor=owner,level='aal2',error=null,photo=new Blob(['RIFF'],{type:'image/webp'});
 const client={
  auth:{
   getUser:async()=>{calls.push('verify-user');return {data:{user:{id:actor}},error};},
   mfa:{getAuthenticatorAssuranceLevel:async()=>{calls.push('verify-aal');return {data:{currentLevel:level}};}}
  },
  storage:{from:bucket=>{
   calls.push('bucket:'+bucket);
   return {
    download:async path=>{calls.push('read:'+path);return {data:photo};},
    upload:async (path,blob,options)=>{calls.push('upload:'+path);assert.equal(blob.type,'image/webp');assert.equal(options.upsert,true);return {data:{path}};},
    remove:async paths=>{calls.push('remove:'+paths[0]);return {data:[]};}
   };
  }}
 };
 return {
  calls,client,blob:photo,
  store:createQaAccountAvatarRepository(client,{url:QA_URL,hostname:QA_INTEGRAL_HOST,getActor:()=>({id:actor})}),
  setActor:id=>{actor=id},setLevel:value=>{level=value},setError:value=>{error=value}
 };
}
test('Private account photo is strictly QA Integral only',()=>{
 assert.equal(accountAvatarEnabled({url:QA_URL,hostname:QA_INTEGRAL_HOST}),true);
 for(const host of ['localhost','qa-pqrs-carrusel-integracion.adphor-platform.pages.dev','adphor.com']){
  assert.equal(accountAvatarEnabled({url:QA_URL,hostname:host}),false);
 }
 assert.equal(createQaAccountAvatarRepository({},{url:QA_URL,hostname:'localhost',getActor:()=>({id:owner})}),null);
 assert.equal(ACCOUNT_AVATAR_BUCKET,'qa-account-avatars');
});
test('Only UUID self-owned fixed avatar path is allowed',()=>{
 assert.equal(accountAvatarPath(owner),owner+'/avatar.webp');
 for(const id of ['JR','../avatar.webp','user@example.com','https://invalid.test/x',null,'',undefined])
  assert.throws(()=>accountAvatarPath(id),/Identificador/);
});
test('Validate bounded image files and require optimized WebP',()=>{
 for(const type of ['image/png','image/jpeg','image/webp'])
  assert.equal(validateAvatarInput({type,size:1024}),true);
 for(const file of [{type:'image/svg+xml',size:1000},{type:'image/jpeg',size:0},{type:'image/jpeg',size:6*1024*1024}])
  assert.throws(()=>validateAvatarInput(file));
 assert.equal(validateWebpAvatar(new Blob(['x'],{type:'image/webp'})),true);
 assert.throws(()=>validateWebpAvatar(new Blob(['x'],{type:'image/png'})));
});
test('AAL2 and remote identity are required before every storage operation',async()=>{
 const f=fixture(),path=accountAvatarPath(owner);
 assert.equal(await f.store.read(owner),f.blob);
 await f.store.upload(owner,f.blob);
 await f.store.remove(owner);
 assert.deepEqual(f.calls.filter(x=>x.includes(path)),['read:'+path,'upload:'+path,'remove:'+path]);
 f.calls.length=0;f.setLevel('aal1');
 await assert.rejects(f.store.read(owner),/MFA/);
 await assert.rejects(f.store.upload(owner,f.blob),/MFA/);
 await assert.rejects(f.store.remove(owner),/MFA/);
 assert.equal(f.calls.some(x=>/^(read|upload|remove):/.test(x)),false);
 f.calls.length=0;f.setLevel('aal2');
 await assert.rejects(f.store.read(other),/sesión/);
 assert.deepEqual(f.calls,[]);
 f.setError({message:'Network'});
 await assert.rejects(f.store.read(owner),/identidad/);
});
test('Absent photo does not substitute another account photo',async()=>{
 const f=fixture();
 f.client.storage.from=()=>({download:async()=>({error:{statusCode:'404',message:'Object not found'}})});
 assert.equal(await f.store.read(owner),null);
});
