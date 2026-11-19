import test from 'node:test';
import assert from 'node:assert/strict';
import {QA_INTEGRAL_HOST,ADPHOR_ONE_MODULES,isIntegralQaHost,visibleAdphorOneModules,enhanceAdphorOneDashboard} from '../src/js/ui-adphor-one.js';

test('ADPHOR ONE is scoped to QA Integral alias or immutable Pages preview hashes',()=>{
  assert.equal(isIntegralQaHost(QA_INTEGRAL_HOST),true);
  assert.equal(isIntegralQaHost('70f51d51.adphor-platform.pages.dev'),true);
  for(const host of ['adphor-platform.pages.dev','qa-pqrs-carrusel-integracion.adphor-platform.pages.dev','adphor-porto-staging.pages.dev','mariauxi.com','localhost','evilqa-integral-claude-reviewed.adphor-platform.pages.dev']) {
    assert.equal(isIntegralQaHost(host),false,host);
  }
});

test('dashboard tiles show only pages already offered by the authorized sidebar',()=>{
 const allowed=['agenda','pqrs','visits','properties','reports'];
 assert.deepEqual(visibleAdphorOneModules(allowed).map(x=>x.id),allowed);
 assert.equal(visibleAdphorOneModules(['agenda','pqrs']).some(x=>x.id==='corporate-staff'),false);
 assert.deepEqual(visibleAdphorOneModules([]),[]);
});

test('module identifiers are unique and all labels and color tokens are explicitly defined',()=>{
 assert.equal(new Set(ADPHOR_ONE_MODULES.map(x=>x.id)).size,ADPHOR_ONE_MODULES.length);
 for(const item of ADPHOR_ONE_MODULES) for(const key of ['id','title','icon','tone','hint']) assert.ok(item[key],key);
});

test('presentation enhancement fails closed when no authenticated dashboard exists',()=>{
 assert.equal(enhanceAdphorOneDashboard({querySelector:()=>null}),false);
 assert.equal(enhanceAdphorOneDashboard(null),false);
});


test('compact secondary navigation does not duplicate circular tools on home', async()=>{
 const {secondaryAdphorOnePages}=await import('../src/js/ui-adphor-one.js');
 const nav=[{id:'dashboard'},{id:'pqrs'},{id:'visits'},{id:'meetings'},{id:'tickets'},{id:'mine'},{id:'access-audit'}];
 assert.deepEqual(secondaryAdphorOnePages(nav,true).map(x=>x.id),['tickets','mine','access-audit']);
 assert.deepEqual(secondaryAdphorOnePages(nav,false).map(x=>x.id),['pqrs','visits','meetings','tickets','mine','access-audit']);
 assert.deepEqual(secondaryAdphorOnePages(null,true),[]);
});
test('full-width shell refuses to activate when no authenticated application exists',async()=>{
 const {enhanceAdphorOneShell}=await import('../src/js/ui-adphor-one.js');
 assert.equal(enhanceAdphorOneShell(null),false);
 assert.equal(enhanceAdphorOneShell({querySelector:()=>null}),false);
});
