import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('../supabase/functions/qa-client-readonly-snapshot/index.ts',import.meta.url),'utf8');

test('read-only function requires correct QA environment, verified caller and MFA',()=>{
 for(const marker of ['qfctnnnnltghepwujpdm','getUser(match[1])',"claims?.aal!=='aal2'",
   "auth.user.email?.toLowerCase()!=='riano200612@gmail.com'", ".eq('user_id',auth.user.id)",
   ".eq('role','admin')", "Authorization:authorization"])
   assert.ok(src.includes(marker),`Missing authorization guard: ${marker}`);
});
test('real-data endpoint never ships service keys, SQL mutations or invented historical totals',()=>{
 assert.ok(!src.includes('SERVICE_ROLE_KEY'));
 assert.ok(!src.includes('service_role'));
 assert.ok(!/\.insert\(|\.update\(|\.upsert\(|\.delete\(/.test(src));
 assert.ok(src.includes('meeting_evidence_rows:null'));
 assert.ok(src.includes('pqrs_evidence_rows:null'));
 assert.ok(src.includes("historical_imported:false"));
});
test('read-only endpoint rejects unauthorized origin and HTTP methods',()=>{
 assert.ok(src.includes("origin!==QA_ORIGIN"));
 assert.ok(src.includes("req.method!=='GET'"));
 assert.ok(src.includes('Cache-Control'));
 assert.ok(src.includes('no-store, private'));
 assert.ok(src.includes("status===204?null"));
});
