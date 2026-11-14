import test from 'node:test';
import assert from 'node:assert/strict';
import {createCorporateStaff} from '../src/js/services/corporate-staff.js';

function fixture({aal='aal2',canManage=true,failWrite=false}={}) {
  const calls=[];
  const client={
    auth:{
      mfa:{getAuthenticatorAssuranceLevel:async()=>({data:{currentLevel:aal}})},
      getUser:async()=>({data:{user:{id:'00000000-0000-4000-8000-000000000001'}}}),
    },
    rpc:async (name,args)=>{
      calls.push([name,args]);
      if(name==='qa_carousel_can_manage') return {data:canManage};
      if(name==='qa_carousel_directory') return {data:[{id:'delegate-1',name:'Empleado QA'}]};
      if(name==='qa_carousel_history') return {data:[]};
      if(name==='qa_carousel_set_visibility') return failWrite ?
        {error:{message:'No autorizado'}} : {data:args.p_visible};
      throw Error('RPC inesperada '+name);
    },
    storage:{from:bucket=>{
      calls.push(['bucket',bucket]);
      return {createSignedUrl:async(path,ttl)=>{
        calls.push(['photo',path,ttl]);
        return {data:{signedUrl:'https://example.invalid/private-photo'}};
      }};
    }},
  };
  return {calls,repo:createCorporateStaff(client)};
}
test('no directory or photo request before MFA AAL2',async()=>{
  const f=fixture({aal:'aal1'});
  await assert.rejects(f.repo.list(),/MFA AAL2/);
  await assert.rejects(f.repo.photo('delegate-1/'+ 'a'.repeat(64)+'.jpg'),/MFA AAL2/);
  assert.deepEqual(f.calls,[]);
});
test('directory uses corporate RPC, never project-scoped staff query',async()=>{
  const f=fixture();
  const people=await f.repo.list();
  assert.equal(people.length,1);
  assert.deepEqual(f.calls,[['qa_carousel_directory',undefined]]);
  assert.equal(await f.repo.canManage(),true);
});
test('visibility toggle has validated ID and confirmed server response',async()=>{
  const f=fixture();
  await assert.rejects(f.repo.setVisible('../bad',true),/inválidos/);
  assert.equal(f.calls.length,0);
  assert.equal(await f.repo.setVisible('delegate-1',false),false);
  assert.deepEqual(f.calls[0],['qa_carousel_set_visibility',{p_staff_id:'delegate-1',p_visible:false}]);
  await assert.rejects(fixture({failWrite:true}).repo.setVisible('delegate-1',false),/No autorizado/);
});
test('photographs use private signed path and TTL, reject arbitrary URLs',async()=>{
  const f=fixture(), path='delegate-1/'+'a'.repeat(64)+'.png';
  await assert.rejects(f.repo.photo('https://example.com/photo.jpg'),/Ruta de fotografía inválida/);
  assert.match(await f.repo.photo(path),/private-photo/);
  assert.deepEqual(f.calls,[['bucket','qa-staff-photos'],['photo',path,300]]);
});
test('history is a corporate RPC subject to AAL2',async()=>{
  const f=fixture();
  assert.deepEqual(await f.repo.history(),[]);
  assert.deepEqual(f.calls,[['qa_carousel_history',undefined]]);
});
