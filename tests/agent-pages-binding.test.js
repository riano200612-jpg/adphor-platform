import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {agentPagesReadOnlyGate as run} from '../src/qa-gates/agent-pages-gate.js';

const HOST='https://qa-integral-claude-reviewed.adphor-platform.pages.dev';
const ID='12345678-1234-4123-8123-123456789abc';
const SUMMARY={id:ID,project_id:'demo-01',engine_kind:'rules',
  status:'Pendiente de aprobación del administrador',source_read_at:'2026-11-17T16:00:00Z'};
const READY={mode:'qa_rules_only',project_id:'demo-01',
  registry_ready:true,reviews_ready:false,rules_ready:false,models_ready:false};

function make(path='/agent-readiness?project_id=demo-01',opt={}){
 const requests=[];
 const {envFlag='true',body=READY,upstreamStatus=200,upstreamType='application/json',
   upstreamHeaders={},method='GET',authorization='Bearer '+('a'.repeat(16)),
   origin=null,bind=true,host=HOST,throws=false}=opt;
 const service={fetch:async req=>{
   requests.push(req);
   if(throws)throw Error('Backend secrets must never reach client');
   return new Response(JSON.stringify(body),{status:upstreamStatus,
     headers:{'Content-Type':upstreamType,'Set-Cookie':'forbidden=1','X-Private':'secret',...upstreamHeaders}});
 }};
 const headers={'Authorization':authorization};
 if(origin!==null)headers['Origin']=origin;
 const request=new Request(host+path,{method,headers});
 return {requests,context:{request,env:{
   ADPHOR_QA_AGENT_READONLY_PROXY_ENABLED:envFlag,
   ...(bind?{ADPHOR_AGENT_READONLY:service}:{})}},
 }};
}
async function denied(status,shape){
 const {requests,context}=make(shape.path??'/agent-readiness?project_id=demo-01',shape);
 const response=await run(context);
 assert.equal(response.status,status);
 assert.equal(requests.length,0);
 assert.equal(response.headers.get('Cache-Control').includes('no-store'),true);
 assert.equal(response.headers.get('Set-Cookie'),null);
}
test('disabled flag and missing binding fail closed, before any upstream call',async()=>{
 await denied(503,{envFlag:'false'});
 await denied(503,{bind:false});
 await denied(503,{envFlag:''});
});
test('wrong host, HTTP, previews, other projects and malformed routes are denied',async()=>{
 await denied(404,{host:'https://cdbb006e.adphor-platform.pages.dev'});
 await denied(404,{host:'https://adphor-platform.pages.dev'});
 await denied(404,{host:'http://qa-integral-claude-reviewed.adphor-platform.pages.dev'});
 for(const path of ['/agent-runs/garbage?project_id=demo-01',
   '/agent-runs/'+ID+'/other?project_id=demo-01',
   '/agent-readiness?project_id=../other',
   '/agent-readiness?project_id=demo-01&project_id=other',
   '/agent-readiness?project_id=demo-01&admin=true',
   '/agent-runs?project_id=demo-01&limit=200',
   '/agent-runs?project_id=demo-01&offset=-1',
   '/agent-runs?project_id=demo-01&offset=10001',
   '/agent-runs?project_id=demo-01&offset=0&offset=1'])
  await denied(400,{path});
});
test('no mutation methods, no origin spoofing and no absent bearer',async()=>{
 for(const method of ['POST','PUT','PATCH','DELETE','OPTIONS'])
   await denied(405,{method});
 await denied(403,{origin:'https://evil.example'});
 await denied(401,{authorization:''});
 await denied(401,{authorization:'Bearer short'});
});
test('internal fetch forwards only human bearer and fixed origin, strips cookies',async()=>{
 const {requests,context}=make();
 const response=await run(context);
 assert.equal(response.status,200);
 assert.deepEqual(await response.json(),READY);
 assert.equal(requests.length,1);
 const req=requests[0];
 assert.equal(req.method,'GET');
 assert.equal(new URL(req.url).hostname,'agent-readonly.internal');
 assert.equal(new URL(req.url).pathname,'/agent-readiness');
 assert.equal(req.headers.get('Authorization'),'Bearer '+('a'.repeat(16)));
 assert.equal(req.headers.get('Origin'),HOST);
 assert.equal(req.headers.get('Cookie'),null);
 assert.equal(req.headers.get('CF-Access-Jwt-Assertion'),null);
 assert.equal(response.headers.get('Set-Cookie'),null);
 assert.equal(response.headers.get('X-Private'),null);
 assert.equal(response.headers.get('Access-Control-Allow-Origin'),null);
});
test('readiness never accepts an enabled write, model or approval flag',async()=>{
 for(const body of [{...READY,rules_ready:true},{...READY,models_ready:true},
   {...READY,reviews_ready:true},{...READY,project_id:'other'},
   {...READY,registry_ready:false},{...READY,mode:'production'}]){
   const {context}=make(undefined,{body});
   assert.equal((await run(context)).status,502);
 }
});
test('tenant scoped listing and exact draft validation reject foreign data',async()=>{
 const good=make('/agent-runs?project_id=demo-01&limit=20&offset=40',
   {body:{items:[SUMMARY],limit:20,offset:40}});
 assert.equal((await run(good.context)).status,200);
 assert.equal(good.requests.length,1);
 assert.ok(good.requests[0].url.includes('project_id=demo-01'));
 for(const body of [{items:[{...SUMMARY,project_id:'foreign'}]},{items:[{...SUMMARY,status:'fake'}]},
   {items:Array(21).fill(SUMMARY)}, {items:'not an array'}]) {
  const {context}=make('/agent-runs?project_id=demo-01',{body});
  assert.equal((await run(context)).status,502);
 }
 const detailPath='/agent-runs/'+ID+'?project_id=demo-01';
 const accepted=make(detailPath,{body:{...SUMMARY,draft:'Synthetic',result_hash:'a'.repeat(64)}});
 assert.equal((await run(accepted.context)).status,200);
 for(const body of [{...SUMMARY,project_id:'other',draft:'No',result_hash:'a'.repeat(64)},
    {...SUMMARY,id:'22345678-1234-4123-8123-123456789abc',draft:'No',result_hash:'a'.repeat(64)},
    {...SUMMARY,draft:'No',result_hash:'forged'}]) {
   const {context}=make(detailPath,{body});
   assert.equal((await run(context)).status,502);
 }
});
test('upstream errors, redirects, invalid JSON and excessive bodies remain opaque',async()=>{
 for(const status of [301,302,401,403,409,500,503]) {
   const {context}=make(undefined,{upstreamStatus:status});
   const response=await run(context);
   assert.equal(response.status,[401,403].includes(status)?status:503);
   assert.doesNotMatch(await response.text(),/secret|backend|stack/i);
 }
 const {context}=make(undefined,{throws:true});
 assert.equal((await run(context)).status,503);
 const invalid=make(undefined,{upstreamType:'text/html'});
 assert.equal((await run(invalid.context)).status,502);
 const huge=make(undefined,{body:{...READY,payload:'x'.repeat(260000)}});
 assert.equal((await run(huge.context)).status,502);
});
test('routes manifest restricts Pages Functions invocation to agent endpoints',()=>{
 const m=JSON.parse(readFileSync(new URL('../public/_routes.json',import.meta.url),'utf8'));
 assert.equal(m.version,1);
 assert.deepEqual(m.include,['/agent-readiness','/agent-runs','/agent-runs/*']);
 assert.deepEqual(m.exclude,[]);
});
