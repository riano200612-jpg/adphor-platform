import test from 'node:test';
import assert from 'node:assert/strict';
import {createIamClient} from '../src/js/services/iam-client.js';
test('IAM client uses user bearer and same-origin Access session without service keys',async()=>{
 const calls=[];const auth={getSession:async()=>({data:{session:{access_token:'synthetic-opaque'}}})};
 const api=createIamClient(auth,async(url,opts)=>{
  calls.push({url,opts});return new Response(JSON.stringify({enabled:true,accounts:[],audit:[]}),{status:200});
 });
 assert.equal((await api.read()).enabled,true);
 await api.command({action:'invite',email:'persona@ejemplo.invalid',name:'Persona',
 assignments:[{project_id:'qa-01',role:'viewer'}],reason:'Solicitud aprobada',
 requestId:'44444444-4444-4444-8444-444444444444'});
 assert.equal(calls.length,2);assert.equal(calls[0].url,'/api/iam');
 assert.equal(calls[0].opts.headers.Authorization,'Bearer synthetic-opaque');
 assert.equal(calls[0].opts.credentials,'same-origin');
 assert.equal(calls[0].opts.redirect,'error');
 assert.equal(calls[0].opts.cache,'no-store');
 assert.equal(calls[0].opts.headers.Cookie,undefined);
 assert.equal(calls[0].opts.headers.apikey,undefined);
 assert.equal(calls[1].opts.credentials,'same-origin');
 assert.equal(calls[1].opts.method,'POST');
 assert.equal(JSON.parse(calls[1].opts.body).action,'invite');
 assert.equal(calls[1].opts.headers['Content-Type'],'application/json');
});
test('IAM client fails closed without a session or authorized API',async()=>{
 const invalid=createIamClient({getSession:async()=>({data:{session:null}})},async()=>{throw Error('must not call');});
 await assert.rejects(invalid.read(),/Inicia sesión/);
 const blocked=createIamClient({getSession:async()=>({data:{session:{access_token:'x'}}})},
   async()=>new Response('{}',{status:403}));
 await assert.rejects(blocked.read(),/permiso administrativo general/);
});

test('la lectura IAM conserva el código HTTP y descarta los detalles privados',async()=>{
 const {verifyGeneralAdmin,corporateAccessNotice}=await import('../src/js/services/delegate-scope.js');
 for(const status of [401,403,502,503]){
  const auth={getSession:async()=>({data:{session:{access_token:'synthetic'}}})};
  const iam=createIamClient(auth,async()=>new Response('{"error":"private-detail"}',{status}));
  let state;
  assert.equal(await verifyGeneralAdmin(iam,{eligible:true,reportStatus:value=>{state=value;}}),false);
  assert.equal(state,'http-'+status);
  assert.ok(corporateAccessNotice(state).includes('HTTP '+status));
  assert.ok(!corporateAccessNotice(state).includes('private-detail'));
 }
});
