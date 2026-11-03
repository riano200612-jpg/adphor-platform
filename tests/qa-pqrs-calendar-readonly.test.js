import test from 'node:test';
import assert from 'node:assert/strict';
import {PQRS_SOURCE_AUDIT} from '../src/js/ui-pqrs-source-status.js';
import {unifiedModuleStatus} from '../src/js/ui-unified-hub.js';

test('PQRS origin snapshot has provenance and does not claim operational sync',()=>{
  assert.equal(PQRS_SOURCE_AUDIT.cases,29);
  assert.equal(PQRS_SOURCE_AUDIT.snapshot,'2026-11-03');
  assert.equal(PQRS_SOURCE_AUDIT.operationalConnected,false);
});

test('QA modules can be navigated without unverified operational permissions',()=>{
  const modules=unifiedModuleStatus({mode:'cloud',portoEnabled:false});
  assert.equal(modules.find(m=>m.id==='meetings').available,true);
  assert.equal(modules.find(m=>m.id==='pqrs').available,true);
  assert.match(modules.find(m=>m.id==='meetings').note,/sin calendario real/i);
  assert.match(modules.find(m=>m.id==='pqrs').note,/sin enlace no hay radicación/i);
});
