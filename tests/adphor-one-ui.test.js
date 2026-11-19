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
