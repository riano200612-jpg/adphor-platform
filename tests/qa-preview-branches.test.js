import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const candidate='qa/integral-claude-reviewed-20261111';
const previous='qa/pqrs-carrusel-integracion-20261104';
const run=(branch,overrides={})=>{
 const env={};for(const key of ['PATH','HOME','LANG','TMPDIR'])if(process.env[key])env[key]=process.env[key];
 Object.assign(env,{CF_PAGES:'1',CF_PAGES_BRANCH:branch,CF_PAGES_COMMIT_SHA:'a'.repeat(40),
 ADPHOR_PROTECTED_STAGING_QA:'true',ADPHOR_QA_ACCESS_VERIFIED:'true',ADPHOR_QA_ACCESS_BOOTSTRAP:'false',
 VITE_SUPABASE_URL:'https://qfctnnnnltghepwujpdm.supabase.co',VITE_SUPABASE_ANON_KEY:'sb_publishable_SYNTHETIC_ONLY',
 VITE_REQUIRE_MFA:'true',VITE_PORTO_QA_ENABLED:'true',VITE_PORTO_STAGING_REF:'qfctnnnnltghepwujpdm',VITE_ADPHOR_QA_READONLY:'false',VITE_VISITS_SQL_ENABLED:'false',...overrides});
 const script=`const {default:factory}=await import('./vite.config.js');const config=factory({mode:'production'});const plugin=config.plugins.find(p=>p.name==='qa-auth-artifact-config');let manifest;plugin.generateBundle.call({emitFile(file){manifest=JSON.parse(file.source);}});console.log(JSON.stringify({base:config.base,manifest}));`;
 return spawnSync(process.execPath,['--input-type=module','-e',script],{cwd:new URL('../',import.meta.url),env,encoding:'utf8',timeout:10000});
};
test('both explicit QA branches produce protected app configuration and the correct non-secret branch manifest',()=>{
 for(const branch of [previous,candidate]){
  const result=run(branch);assert.equal(result.status,0,result.stderr);
  const {base,manifest}=JSON.parse(result.stdout);
  assert.equal(base,'/');assert.equal(manifest.branch,branch);
  assert.equal(manifest.backendUrl,'https://qfctnnnnltghepwujpdm.supabase.co');
  assert.equal(manifest.requireMfa,'true');assert.equal(manifest.visitsSqlEnabled,false);
  assert.equal(manifest.readOnlyMode,false);assert.equal(manifest.buildConfigurationOnly,true);
  assert.equal(result.stdout.includes('sb_publishable_SYNTHETIC_ONLY'),false);
 }
});
test('review preview remains blocked for missing security, wrong database, readonly/demo, bootstrap or unrelated branch',()=>{
 for(const override of [
  {ADPHOR_PROTECTED_STAGING_QA:'false'},{ADPHOR_QA_ACCESS_VERIFIED:'false'},
  {VITE_REQUIRE_MFA:'false'},{VITE_SUPABASE_ANON_KEY:''},{VITE_ADPHOR_QA_READONLY:'true'},
  {VITE_SUPABASE_URL:'https://oqizvirqjwbbhyyjpthq.supabase.co'},
  {VITE_PORTO_STAGING_REF:'oqizvirqjwbbhyyjpthq'},{ADPHOR_QA_ACCESS_BOOTSTRAP:'true'},
  {CF_PAGES_BRANCH:'qa/unapproved-branch'}
 ]){
  const result=run(candidate,override);assert.notEqual(result.status,0,JSON.stringify(Object.keys(override)));
  assert.match(result.stderr,/QA_(?:DEPLOY|AUTH_CONFIG)_BLOCKED/);
 }
});
