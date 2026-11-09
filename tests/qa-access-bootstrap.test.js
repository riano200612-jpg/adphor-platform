import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync, readdirSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

// Real Vite builds verify that public/ files, app modules and client env values
// cannot enter the unverified Access probe, even if demo inputs are requested.
test('Access bootstrap emits only the static probe and rejects other branches', () => {
  const out = mkdtempSync(join(tmpdir(), 'adphor-access-'));
  const env = {...process.env, CF_PAGES:'1',
    CF_PAGES_BRANCH:'qa/pqrs-carrusel-integracion-20261104',
    ADPHOR_PROTECTED_STAGING_QA:'true', ADPHOR_QA_ACCESS_VERIFIED:'false',
    ADPHOR_QA_ACCESS_BOOTSTRAP:'true', ADPHOR_BUILD_QA_DEMOS:'true',
    VITE_SUPABASE_ANON_KEY:'MUST_NOT_APPEAR_IN_PROBE'};
  const build = changes => spawnSync(process.execPath,
    ['node_modules/vite/bin/vite.js','build','--outDir',out],
    {env:{...env,...changes},encoding:'utf8'});
  try {
    const result=build({});
    assert.equal(result.status,0,result.stderr);
    assert.deepEqual(readdirSync(out),['index.html']);
    const html=readFileSync(join(out,'index.html'),'utf8');
    assert.ok(html.includes('ADPHOR_QA_ACCESS_PROBE_V1'));
    assert.doesNotMatch(html,/MUST_NOT_APPEAR|<script|supabase\.co/);
    for (const changes of [
      {CF_PAGES_BRANCH:'qa/unapproved'},
      {ADPHOR_PROTECTED_STAGING_QA:'false'},
      {ADPHOR_QA_ACCESS_BOOTSTRAP:'false'},
    ]) {
      const denied=build(changes);
      assert.notEqual(denied.status,0);
      assert.match(denied.stderr,/QA_DEPLOY_BLOCKED/);
    }
  } finally {rmSync(out,{recursive:true,force:true});}
});
