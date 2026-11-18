import test from 'node:test';
import assert from 'node:assert/strict';
import {createIamQaHandler} from '../src/qa-gates/iam-api-gate.js';
const HOST='https://qa-integral-claude-reviewed.adphor-platform.pages.dev';
const ACTOR='11111111-1111-4111-8111-111111111111';
const SESSION='22222222-2222-4222-8222-222222222222';
const TARGET='33333333-3333-4333-8333-333333333333';
const REQUEST='44444444-4444-4444-8444-444444444444';
const env={ADPHOR_QA_IAM_ENABLED:'true',ADPHOR_QA_IAM_REF:'qfctnnnnltghepwujpdm',
 SUPABASE_SERVICE_ROLE_KEY:'synthetic-private-test-only'};
const input={action:'invite',email:'persona@ejemplo.co',name:'Persona de prueba',
 assignments:[{project_id:'qa-01',role:'viewer'}],reason:'Alta autorizada para prueba',requestId:REQUEST};

function fixture({allowed=true,aal='aal2',userId=ACTOR,claimsSub=ACTOR,
 inviteError=false,banError=false,operatorError=false}={}){
 const calls=[];
 const client={
  auth:{
   getUser:async()=>({data:{user:{id:userId}},error:null}),
   getClaims:async()=>({data:{claims:{sub:claimsSub,aal,session_id:SESSION}},error:null}),
   admin:{
    inviteUserByEmail:async(email,options)=>{calls.push(['invite',email,options]);return inviteError?
      {error:{message:'synthetic provider failed'}}:{data:{user:{id:TARGET}},error:null};},
    updateUserById:async(id,attrs)=>{calls.push(['ban',id,attrs]);return {error:banError?{message:'synthetic error'}:null,data:{user:{id}}};}
   }
  },
  rpc:async(name,args)=>{
   calls.push(['rpc',name,args]);
   if(operatorError&&name==='qa_iam_is_operator')return {error:{message:'unavailable'},data:null};
   if(name==='qa_iam_is_operator')return{data:allowed,error:null};
   if(name==='qa_iam_snapshot')return{data:{accounts:[],audit:[]},error:null};
   if(name==='qa_iam_command')return{data:{user_id:TARGET,status:'database_applied'},error:null};
   return{data:null,error:{message:'unexpected'}};
  }
 };
 let factories=0;
 const handler=createIamQaHandler((url,key,options)=>{
  factories++;assert.match(url,/qfctnnnnltghepwujpdm/);
  assert.equal(key,env.SUPABASE_SERVICE_ROLE_KEY);
  assert.equal(options.auth.persistSession,false);
  return client;
 });
 const request=(method='GET',payload=null,override={})=>new Request(override.url||HOST+'/api/iam',{
  method,headers:{
   Authorization:override.auth===undefined?'Bearer '+('A'.repeat(100)):override.auth,
   ...(method==='POST'?{Origin:override.origin??HOST}:override.origin?{Origin:override.origin}:{})
  },
  ...(method==='POST'?{body:JSON.stringify(payload||input)}:{})
 });
 return {calls,handler,request,getFactories:()=>factories};
}
test('not enabled denies every request without constructing a Supabase client',async()=>{
 const f=fixture();
 assert.equal((await f.handler({request:f.request(),env:{...env,ADPHOR_QA_IAM_ENABLED:'false'}})).status,503);
 assert.equal((await f.handler({request:f.request(),env:{...env,SUPABASE_SERVICE_ROLE_KEY:''}})).status,503);
 assert.equal((await f.handler({request:f.request(),env:{...env,ADPHOR_QA_IAM_REF:'other'}})).status,503);
 assert.equal(f.getFactories(),0);
});
test('exact origin, route and method are mandatory before accessing backend',async()=>{
 const f=fixture();
 for(const url of ['https://fake.example/api/iam',HOST+'/api/iam?extra=1',
 'https://a3abd4f9.adphor-platform.pages.dev/api/iam','http://qa-integral-claude-reviewed.adphor-platform.pages.dev/api/iam'])
   assert.equal((await f.handler({request:f.request('GET',null,{url}),env})).status,404);
 assert.equal((await f.handler({request:f.request('DELETE',null),env})).status,405);
 assert.equal((await f.handler({request:f.request('POST',input,{origin:'https://evil.example'}),env})).status,403);
 assert.equal((await f.handler({request:f.request('POST',input,{origin:'null'}),env})).status,403);
 assert.equal((await f.handler({request:f.request('GET',null,{auth:''}),env})).status,401);
 assert.equal(f.getFactories(),0);
});
test('non operators, AAL1 and forged identity are denied before any management command',async()=>{
 for(const opts of [{allowed:false},{aal:'aal1'},{claimsSub:TARGET},{operatorError:true}]){
  const f=fixture(opts);const res=await f.handler({request:f.request('POST'),env});
  assert.equal([403,503].includes(res.status),true);
  assert.equal(f.calls.some(x=>x[0]==='invite'||x[1]==='qa_iam_command'),false);
 }
});
test('read path requires authorized technical admin and has no cache or secrets',async()=>{
 const f=fixture();
 const res=await f.handler({request:f.request(),env});
 assert.equal(res.status,200);assert.deepEqual(await res.json(),{enabled:true,admin_state:null,accounts:[],audit:[]});
 assert.match(res.headers.get('Cache-Control'),/no-store/);
 assert.equal(res.headers.get('Set-Cookie'),null);
 assert.equal(res.headers.get('Access-Control-Allow-Origin'),null);
});
test('invite executes private allowlist preparation before Auth, then grants to exact invited account',async()=>{
 const f=fixture();
 const res=await f.handler({request:f.request('POST'),env});
 assert.equal(res.status,201);
 const p=f.calls.filter(x=>x[0]==='rpc'&&x[1]==='qa_iam_command');
 assert.equal(p.length,2);
 assert.equal(p[0][2].p_action,'prepare_invite');
 assert.equal(p[1][2].p_action,'link_invite');
 assert.equal(p[1][2].p_user,TARGET);
 assert.ok(f.calls.findIndex(x=>x[0]==='invite')>f.calls.indexOf(p[0]));
 assert.equal(f.calls.some(x=>x[0]==='ban'),false);
});
test('provider invitation failure cancels prepared privilege window and denies success',async()=>{
 const f=fixture({inviteError:true});
 const res=await f.handler({request:f.request('POST'),env});
 assert.equal(res.status,503);
 const cmds=f.calls.filter(x=>x[1]==='qa_iam_command').map(x=>x[2].p_action);
 assert.deepEqual(cmds,['prepare_invite','cancel_invite']);
});
test('untrusted values never grant global admin or foreign property',async()=>{
 const f=fixture();
 for(const payload of [{...input,assignments:[{project_id:'qa-01',role:'technical_admin'}]},
 {...input,assignments:[{project_id:'qa-01',role:'viewer'},{project_id:'qa-01',role:'admin'}]},
 {...input,email:'invalid'}, {...input,requestId:'bad'}]){
  const res=await f.handler({request:f.request('POST',payload),env});
  assert.equal(res.status,400);
 }
 assert.equal(f.calls.some(x=>x[1]==='qa_iam_command'),false);
});
test('suspend and offboard revoke database access BEFORE provider ban and audit result',async()=>{
 for(const action of ['suspend','offboard']){
  const f=fixture();const res=await f.handler({request:f.request('POST',{...input,action,assignments:[]}),env});
  assert.equal(res.status,200);
  const commands=f.calls.filter(x=>x[1]==='qa_iam_command').map(x=>x[2].p_action);
  assert.deepEqual(commands,[action,'confirm_auth_ban']);
  assert.equal(f.calls.findIndex(x=>x[0]==='ban')>f.calls.findIndex(x=>x[1]==='qa_iam_command'),true);
  assert.equal(f.calls.find(x=>x[0]==='ban')[2].ban_duration,'876000h');
 }
});
test('Auth failure must be reported as PARTIAL, never as completed offboard',async()=>{
 const f=fixture({banError:true});
 const res=await f.handler({request:f.request('POST',{...input,action:'offboard'}),env});
 assert.equal(res.status,202);assert.equal((await res.json()).status,'access_restricted_auth_pending');
 const actions=f.calls.filter(x=>x[1]==='qa_iam_command').map(x=>x[2].p_action);
 assert.deepEqual(actions,['offboard']);
});
