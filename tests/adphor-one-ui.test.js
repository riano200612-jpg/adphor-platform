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


test('every authorized route, including general administration, is a visible circle', async()=>{
 const {completeAdphorOneCatalog}=await import('../src/js/ui-adphor-one.js');
 const complete=[
 'dashboard','meetings','agenda','visits','pqrs','unified','properties',
 'tickets','recorridos','mine','areas','reports','agent-history',
 'staff','corporate-staff','qa-source','access-audit','consultation'
 ];
 const nav=complete.map(id=>({id,label:id,icon:'fa-solid fa-circle'}));
 const tools=complete.filter(id=>id!=='dashboard');
 assert.deepEqual(new Set(completeAdphorOneCatalog(nav).map(x=>x.id)),new Set(tools));
 assert.equal(completeAdphorOneCatalog(nav).length,17);
 assert.equal(completeAdphorOneCatalog(nav).some(x=>x.id==='access-audit'),true);
 assert.equal(completeAdphorOneCatalog(nav).some(x=>x.id==='qa-source'),true);
 assert.deepEqual(completeAdphorOneCatalog(nav.slice(0,13)).map(x=>x.id).sort(),complete.slice(0,13).filter(id=>id!=='dashboard').sort());
 assert.equal(completeAdphorOneCatalog(nav.slice(0,13)).some(x=>x.id==='access-audit'),false);
 assert.deepEqual(completeAdphorOneCatalog(null),[]);
 assert.equal(completeAdphorOneCatalog([...nav,nav[0]]).length,17);
 assert.equal(completeAdphorOneCatalog(nav).some(x=>x.id==='dashboard'),false);
});
test('an already-authorized future module also gets a circle, not a hidden link',async()=>{
 const {completeAdphorOneCatalog}=await import('../src/js/ui-adphor-one.js');
 const catalog=completeAdphorOneCatalog([{id:'new-module',label:'Nueva herramienta',icon:'fa-solid fa-wrench'}]);
 assert.deepEqual(catalog.map(x=>({id:x.id,title:x.title,group:x.group})),[{id:'new-module',title:'Nueva herramienta',group:'other'}]);
});
test('full-width shell refuses to activate when no authenticated application exists',async()=>{
 const {enhanceAdphorOneShell}=await import('../src/js/ui-adphor-one.js');
 assert.equal(enhanceAdphorOneShell(null),false);
 assert.equal(enhanceAdphorOneShell({querySelector:()=>null}),false);
});

test('Resumen is only a return-to-Inicio control and not a visible task tile',async()=>{
 const {completeAdphorOneCatalog}=await import('../src/js/ui-adphor-one.js');
 const nav=[{id:'dashboard',label:'Resumen'},{id:'pqrs',label:'PQRS'},{id:'visits',label:'Visitas'}];
 assert.deepEqual(completeAdphorOneCatalog(nav).map(x=>x.id),['pqrs','visits']);
 assert.equal(visibleAdphorOneModules(['dashboard','pqrs']).some(x=>x.id==='dashboard'),false);
});
