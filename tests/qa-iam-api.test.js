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
 inviteError=false,banError=false,operatorError=false,legacyReview=null,
 legacyEligible=true,legacyLinkError=false}={}){
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
   if(name==='qa_iam_legacy_review')return legacyReview?{data:legacyReview,error:null}:{data:null,error:{message:'not yet installed'}};
   if(name==='qa_iam_legacy_eligible')return {data:legacyEligible,error:null};
   if(name==='qa_iam_legacy_link_invite')return legacyLinkError?
    {data:null,error:{message:'synthetic alias rejected'}}:
    {data:{status:'legacy_invited',auth_linked:true,active:false},error:null};
   if(name==='qa_iam_command'){
    if(args.p_action==='suspend')return{data:{user_id:TARGET,status:'restricted_pending_auth_ban'},error:null};
    if(args.p_action==='confirm_auth_ban')return{data:{user_id:TARGET,status:'ban_verified'},error:null};
    return{data:{user_id:TARGET,status:'database_applied'},error:null};
   }
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

test('legacy review is restricted to AAL2 operator and response never leaks source credentials',async()=>{
 const source={total:1,candidates:[{username:'j.guzman',display_name:'Persona QA',
  legacy_status:'Activo',review_classification:'MATCHED',staff_matched:true,
  auth_linked:false,secret_pin:'never-copy',email:'private@example.invalid'}]};
 const allowed=fixture({legacyReview:source});
 const res=await allowed.handler({request:allowed.request(),env});
 assert.equal(res.status,200);
 const body=await res.json();
 assert.deepEqual(body.legacy_review,{total:1,candidates:[{
  username:'j.guzman',display_name:'Persona QA',legacy_status:'Activo',
  review_classification:'MATCHED',staff_matched:true,auth_linked:false
 }]});
 assert.equal(JSON.stringify(body).includes('never-copy'),false);
 const denied=fixture({allowed:false,legacyReview:source});
 assert.equal((await denied.handler({request:denied.request(),env})).status,403);
 assert.equal(denied.calls.some(c=>c[1]==='qa_iam_legacy_review'),false);
});
test('invalid legacy-review data fails closed without impacting current IAM',async()=>{
 const source={total:1,candidates:[{username:'<script>',display_name:'Injected',
  legacy_status:'Activo',review_classification:'MATCHED',staff_matched:true,
  auth_linked:false}]};
 const f=fixture({legacyReview:source});
 const res=await f.handler({request:f.request(),env});
 assert.equal(res.status,200);
 assert.equal((await res.json()).legacy_review,undefined);
});

test('matched legacy alias requires operator-AAL2 preflight and exact invited user linkage',async()=>{
 const f=fixture();
 const res=await f.handler({request:f.request('POST',{...input,historic_alias:'j.guzman'}),env});
 assert.equal(res.status,201);const data=await res.json();
 assert.equal(data.historic_alias,'j.guzman');assert.equal(data.alias_state,'INVITED');
 const methods=f.calls.filter(x=>x[0]==='rpc').map(x=>x[1]);
 assert.deepEqual(methods,[
 'qa_iam_is_operator','qa_iam_legacy_eligible','qa_iam_command',
 'qa_iam_command','qa_iam_legacy_link_invite'
 ]);
 const binding=f.calls.find(x=>x[1]==='qa_iam_legacy_link_invite')[2];
 assert.deepEqual([binding.p_actor,binding.p_session,binding.p_alias,binding.p_email,
  binding.p_user,binding.p_name],[ACTOR,SESSION,'j.guzman',input.email,TARGET,input.name]);
});
test('blocked or unmatched legacy aliases are denied before any IAM or email mutation',async()=>{
 for(const opts of [{legacyEligible:false},{allowed:false},{aal:'aal1'}]){
  const f=fixture(opts);
  const result=await f.handler({request:f.request('POST',{...input,historic_alias:'j.guzman'}),env});
  assert.equal(result.status,403);
  assert.equal(f.calls.some(x=>x[0]==='invite'||x[1]==='qa_iam_command'),false);
 }
});
test('malformed legacy alias and alias in non-invite actions fail before Auth mutation',async()=>{
 const f=fixture();
 for(const command of [
  {...input,historic_alias:'<script>'},
  {...input,historic_alias:'J.Guzman'},
  {...input,historic_alias:'j.guzman',action:'grant'}
 ]){
  const res=await f.handler({request:f.request('POST',command),env});
  assert.equal(res.status,400);
 }
 assert.equal(f.calls.some(x=>x[0]==='invite'||x[1]==='qa_iam_command'),false);
});
test('email invitation without alias remains unchanged; alias reconciliation failure is explicitly partial',async()=>{
 const noAlias=fixture();const regular=await noAlias.handler({request:noAlias.request('POST'),env});
 assert.equal(regular.status,201);
 assert.equal(noAlias.calls.some(x=>x[1]==='qa_iam_legacy_eligible'||x[1]==='qa_iam_legacy_link_invite'),false);
 const failed=fixture({legacyLinkError:true});
 const res=await failed.handler({request:failed.request('POST',{...input,historic_alias:'j.guzman'}),env});
 assert.equal(res.status,202);const body=await res.json();
 assert.equal(body.status,'pending_reconciliation');
 assert.deepEqual([body.database_restricted,body.auth_banned,body.audit_confirmed],[true,true,true]);
 assert.equal(failed.calls.some(x=>x[0]==='invite'),true);
 const actions=failed.calls.filter(x=>x[1]==='qa_iam_command').map(x=>x[2].p_action);
 assert.deepEqual(actions,['prepare_invite','link_invite','suspend','confirm_auth_ban']);
 const banned=failed.calls.find(x=>x[0]==='ban');
 assert.equal(banned[1],TARGET);
 assert.equal(banned[2].ban_duration,'876000h');
});
test('failed provider invitation cannot create alias link and cancels prepared IAM request',async()=>{
 const failed=fixture({inviteError:true});
 const res=await failed.handler({request:failed.request('POST',{...input,historic_alias:'j.guzman'}),env});
 assert.equal(res.status,503);
 const called=failed.calls.map(x=>x[1]);
 assert.equal(called.includes('qa_iam_legacy_link_invite'),false);
 assert.equal(called.filter(x=>x==='qa_iam_command').length,2);
});

test('if Auth ban provider fails after alias linking, IAM is still restricted and result is partial',async()=>{
 const f=fixture({legacyLinkError:true,banError:true});
 const res=await f.handler({request:f.request('POST',{...input,historic_alias:'j.guzman'}),env});
 assert.equal(res.status,202);
 const body=await res.json();
 assert.equal(body.database_restricted,true);
 assert.equal(body.auth_banned,false);
 assert.equal(body.audit_confirmed,false);
 assert.deepEqual(f.calls.filter(x=>x[1]==='qa_iam_command').map(x=>x[2].p_action),
  ['prepare_invite','link_invite','suspend']);
});
