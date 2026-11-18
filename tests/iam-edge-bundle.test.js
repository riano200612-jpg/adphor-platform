import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('QA Edge source bundle exactly matches the tested isolated authorization gate',()=>{
 for(const name of ['iam-edge-adapter.js','iam-api-gate.js']){
  const tested=readFileSync(new URL('../src/qa-gates/'+name,import.meta.url),'utf8');
  const bundled=readFileSync(new URL('../supabase/functions/adphor-iam/'+name,import.meta.url),'utf8');
  assert.equal(bundled,tested,name+' diverged from tested gate');
 }
 const entry=readFileSync(new URL('../supabase/functions/adphor-iam/index.ts',import.meta.url),'utf8');
 assert.ok(entry.includes("createIamEdgeAdapter"));
 assert.ok(!entry.includes("hardcoded-password"));
});
