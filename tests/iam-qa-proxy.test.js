import test from 'node:test';
import assert from 'node:assert/strict';
import {iamPagesProxy} from '../src/qa-gates/iam-pages-proxy.js';
import {createIamEdgeAdapter} from '../src/qa-gates/iam-edge-adapter.js';
const HOST='https://qa-integral-claude-reviewed.adphor-platform.pages.dev';
const API='https://qfctnnnnltghepwujpdm.supabase.co/functions/v1/adphor-iam';
const ACTOR='11111111-1111-4111-8111-111111111111';
const SESSION='22222222-2222-4222-8222-222222222222';
const AUTH='Bearer '+('A'.repeat(110));
const ENV={ADPHOR_QA_IAM_PROXY_ENABLED:'true',
 VITE_SUPABASE_URL:'https://qfctnnnnltghepwujpdm.supabase.co',
 VITE_SUPABASE_ANON_KEY:'test-only-public-key'};
const S={QA_REF:'qfctnnnnltghepwujpdm',SUPABASE_SERVICE_ROLE_KEY:'synthetic-private-only'};
function req(url=HOST+'/api/iam',method='GET',origin=HOST){
 return new Request(url,{method,headers:{
  'Authorization':AUTH,'Origin':origin
 }, ...(method==='POST'?{body:JSON.stringify({test:'synthetic'})}:{})});
}
test('Cloudflare IAM proxy fails closed until QA flag, project and publishable key match',async()=>{
 let calls=0;const transport=async()=>{calls++;return new Response('{}')};
 for(const env of [{...ENV,ADPHOR_QA_IAM_PROXY_ENABLED:'false'},
  {...ENV,VITE_SUPABASE_URL:'https://wrong.supabase.co'},
  {...ENV,VITE_SUPABASE_ANON_KEY:''}]){
   const res=await iamPagesProxy({request:req(),env},transport);
   assert.equal(res.status,503);
 }
 assert.equal(calls,0);
});
test('Cloudflare IAM proxy rejects forged route, method or origin before forwarding',async()=>{
 let calls=0;const transport=async()=>{calls++;return new Response('{}')};
 for(const [url,method,origin,status] of [
  [HOST+'/api/iam?admin=1','GET',HOST,404],
  ['https://random.adphor-platform.pages.dev/api/iam','GET',HOST,404],
  [HOST+'/api/iam','DELETE',HOST,405],
  [HOST+'/api/iam','POST','https://evil.example',403]
 ]){
   assert.equal((await iamPagesProxy({request:req(url,method,origin),env:ENV},transport)).status,status);
 }
 assert.equal(calls,0);
});
test('IAM proxy only forwards bearer to fixed QA Edge, strips cookies and backend headers',async()=>{
 let passed;
 const transport=async(url,options)=>{
  passed={url,options};
  return new Response(JSON.stringify({enabled:true,accounts:[],audit:[]}),{status:200,headers:{
   'Content-Type':'application/json','Set-Cookie':'forbidden=1','X-Private':'never',
   'Access-Control-Allow-Origin':'*'
  }});
 };
 const result=await iamPagesProxy({request:req(),env:ENV},transport);
 assert.equal(result.status,200);
 assert.equal(passed.url,API);
 assert.equal(passed.options.headers.Authorization,AUTH);
 assert.equal(passed.options.headers.apikey,ENV.VITE_SUPABASE_ANON_KEY);
 assert.equal(passed.options.headers.Origin,HOST);
 assert.equal(passed.options.headers.Cookie,undefined);
 assert.equal(result.headers.get('Set-Cookie'),null);
 assert.equal(result.headers.get('X-Private'),null);
 assert.equal(result.headers.get('Access-Control-Allow-Origin'),null);
});
test('Edge adapter requires a private service key, exact project and QA origin',async()=>{
 let called=0;const handler=createIamEdgeAdapter(()=>{called++;return{};});
 for(const [request,secrets,status] of [
  [req(API,'GET','https://attacker.example'),S,403],
  [req('https://evil.example/functions/v1/adphor-iam'),S,404],
  [req(API,'GET',HOST),{...S,QA_REF:'another-project'},503],
  [req(API,'GET',HOST),{...S,SUPABASE_SERVICE_ROLE_KEY:''},503]
 ]){
  assert.equal((await handler(request,secrets)).status,status);
 }
 assert.equal(called,0);
});
test('Edge adapter verifies current account, AAL2, session, active admin and delegates only then',async()=>{
 const calls=[];
 const client={auth:{
  getUser:async()=>({data:{user:{id:ACTOR}}}),
  getClaims:async()=>({data:{claims:{sub:ACTOR,aal:'aal2',session_id:SESSION}}})},
  rpc:async(name,args)=>{
   calls.push({name,args});
   if(name==='qa_iam_is_operator')return{data:true};
   if(name==='qa_iam_snapshot')return{data:{accounts:[],audit:[],admin_state:{configured:3,active:1}}};
   return{error:{message:'denied'}};
  }};
 const handler=createIamEdgeAdapter((_url,key)=>{assert.equal(key,S.SUPABASE_SERVICE_ROLE_KEY);return client;});
 const result=await handler(req(API,'GET',HOST),S);
 assert.equal(result.status,200);
 const body=await result.json();
 assert.equal(body.admin_state.active,1);
 assert.deepEqual(calls.map(x=>x.name),['qa_iam_is_operator','qa_iam_snapshot']);
});
