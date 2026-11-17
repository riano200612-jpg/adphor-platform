import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runBootstrapCheck,validateAccount,validateConfig,assertNoPublicSubdomain,assertWorkerState} from '../qa/security/private-worker-bootstrap-core.mjs';
const valid=JSON.parse(readFileSync(new URL('../backend/wrangler.qa.jsonc',import.meta.url),'utf8'));
const account='d7c467dca048f6f09a93d78bb59e616d';
const env={CLOUDFLARE_ACCOUNT_ID:account,CLOUDFLARE_API_TOKEN:'synthetic-qa-token-for-tests'};
test('bootstrap keeps exclusively QA destination and disabled private config',()=>{
  assert.doesNotThrow(()=>validateConfig(valid));
  assert.doesNotThrow(()=>validateAccount(account));
  for(const [field,value] of Object.entries({
    workers_dev:true,preview_urls:true,route:'x.example/*',
    routes:['x.example/*'],name:'adphor-ai',triggers:{crons:['* * * * *']},
  }))assert.throws(()=>validateConfig({...valid,[field]:value}),/private/);
  assert.throws(()=>validateConfig({...valid,vars:{...valid.vars,QA_AGENT_READONLY_ENABLED:'true'}}),/private/);
  assert.throws(()=>validateConfig({...valid,vars:{...valid.vars,SUPABASE_URL:'https://prod.supabase.co'}}),/private/);
  assert.throws(()=>validateConfig({...valid,vars:{...valid.vars,ADMIN_KEY:'secret'}}),/private/);
  assert.throws(()=>validateAccount('different-account'),/account/);
});
test('one-time preflight fails closed on existing script or missing token',async()=>{
  assertWorkerState([],'preflight');
  assert.throws(()=>assertWorkerState([{id:'adphor-ai-qa'}],'preflight'),/already exists/);
  assert.throws(()=>assertWorkerState([],'postflight'),/not confirmed/);
  await assert.rejects(runBootstrapCheck('preflight',{env:{...env,CLOUDFLARE_API_TOKEN:''},
    fetcher:()=>{throw Error('No network expected');}}),/credential/);
});
test('preflight and postflight query only expected Cloudflare read URLs, no secrets in output',async()=>{
  const urls=[];
  const fetcher=async (url,opts)=>{
    urls.push(url);
    assert.equal(opts.method,'GET');
    assert.equal(opts.redirect,'error');
    assert.equal(opts.headers.Authorization,'Bearer '+env.CLOUDFLARE_API_TOKEN);
    return {ok:true,status:200,json:async()=>({
      success:true,
      result:url.endsWith('/subdomain')?{enabled:false}:
        urls.length===1?[]:[{id:'adphor-ai-qa'}],
    })};
  };
  const a=await runBootstrapCheck('preflight',{env,fetcher});
  const b=await runBootstrapCheck('postflight',{env,fetcher});
  assert.equal(a,'PRIVATE_QA_WORKER_PREFLIGHT_PASS');
  assert.equal(b,'PRIVATE_QA_WORKER_POSTFLIGHT_PASS');
  assert.deepEqual(urls,[
    'https://api.cloudflare.com/client/v4/accounts/'+account+'/workers/scripts',
    'https://api.cloudflare.com/client/v4/accounts/'+account+'/workers/scripts',
    'https://api.cloudflare.com/client/v4/accounts/'+account+'/workers/scripts/adphor-ai-qa/subdomain',
  ]);
});
test('public subdomains, malformed Cloudflare responses and HTTP errors never pass',async()=>{
  assert.throws(()=>assertNoPublicSubdomain({enabled:true}),/not confirmed/);
  assert.throws(()=>assertNoPublicSubdomain({}),/not confirmed/);
  await assert.rejects(runBootstrapCheck('preflight',{env,fetcher:async()=>({ok:false,status:403})}),/read failed/);
  await assert.rejects(runBootstrapCheck('preflight',{env,fetcher:async()=>({ok:true,json:async()=>({success:false})})}),/confirm success/);
});
