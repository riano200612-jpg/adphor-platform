import test from 'node:test';
import assert from 'node:assert/strict';
import {assertReleaseContext,assertAccessRedirect,target,preflight} from '../qa/deploy-preflight.mjs';
const environment=()=>({GITHUB_REPOSITORY:target.repository,GITHUB_EVENT_NAME:'push',GITHUB_REF:'refs/heads/'+target.branch,GITHUB_SHA:'a'.repeat(40),ADPHOR_QA_DEPLOY_ENABLED:'true',ADPHOR_QA_ACCESS_VERIFIED:'true',ADPHOR_QA_URL:target.qaUrl,CLOUDFLARE_ACCOUNT_ID:target.cloudflareAccountId,VITE_SUPABASE_URL:`https://${target.supabaseRef}.supabase.co`,VITE_SUPABASE_ANON_KEY:'sb_publishable_test',CLOUDFLARE_API_TOKEN:'test-only'});
test('release context rejects other branches, forks, PRs, production DB and missing approval',()=>{
 for(const patch of [{GITHUB_REF:'refs/heads/main'},{GITHUB_REPOSITORY:'other/adphor-platform'},{GITHUB_EVENT_NAME:'pull_request'},{ADPHOR_QA_ACCESS_VERIFIED:'false'},{ADPHOR_QA_URL:'https://adphor-platform.pages.dev'},{VITE_SUPABASE_URL:'https://oqizvirqjwbbhyyjpthq.supabase.co'},{CLOUDFLARE_API_TOKEN:''},{VITE_SUPABASE_ANON_KEY:'eyJ-invalid-legacy-key'}])assert.throws(()=>assertReleaseContext({...environment(),...patch}),/QA_RELEASE_BLOCKED/);
});
test('public responses and lookalike redirects cannot pass Access preflight',()=>{
 for(const [status,location] of [[200,null],[403,null],[302,'https://cloudflareaccess.com.evil.invalid/cdn-cgi/access/login/x'],[302,'http://qa.cloudflareaccess.com/cdn-cgi/access/login/x'],[302,'https://qa.cloudflareaccess.com/other']])assert.throws(()=>assertAccessRedirect(status,location),/QA_RELEASE_BLOCKED/);
 assert.doesNotThrow(()=>assertAccessRedirect(302,'https://qa.cloudflareaccess.com/cdn-cgi/access/login/preview'));
});
test('preflight rejects a Pages configuration that makes integration the production branch',async()=>{
 let calls=0;
 await assert.rejects(preflight(environment(),async()=>{calls++;return {ok:true,json:async()=>({success:true,result:{name:target.pagesProject,production_branch:target.branch}})};}),/QA would target production/);
 assert.equal(calls,1);
});
