import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveOriginalPqrsExec,QA_INTEGRAL_PQRS_EXEC} from '../src/js/services/pqrs-original-qa-link.js';
const qa='qa-integral-claude-reviewed.adphor-platform.pages.dev';
const prod='adphor-platform.pages.dev';
const alternate='https://script.google.com/macros/s/ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcd/exec';
test('only admin at exact QA Integral alias inherits original Apps Script access',()=>{
  assert.equal(resolveOriginalPqrsExec({hostname:qa,role:'admin'}),QA_INTEGRAL_PQRS_EXEC);
});
test('production and other previews never inherit the fallback',()=>{
  for(const hostname of [prod,'preview.adphor-platform.pages.dev',qa+'.evil.invalid','localhost'])
    assert.equal(resolveOriginalPqrsExec({hostname,role:'admin'}),'');
});
test('non-admin QA roles do not inherit the fallback',()=>{
  for(const role of ['coordinator','technician','member',''])
    assert.equal(resolveOriginalPqrsExec({hostname:qa,role}),'');
});
test('explicit environment overrides fallback and drops URL query parameters',()=>{
  assert.equal(resolveOriginalPqrsExec({hostname:qa,role:'admin',environment:alternate+'?token=discarded'}),alternate);
});
test('browser configuration overrides fallback but not explicit environment',()=>{
  assert.equal(resolveOriginalPqrsExec({hostname:qa,role:'admin',stored:alternate}),alternate);
  assert.equal(resolveOriginalPqrsExec({hostname:qa,role:'admin',stored:alternate,environment:QA_INTEGRAL_PQRS_EXEC}),QA_INTEGRAL_PQRS_EXEC);
});
test('unsafe explicit URL is refused, never quietly substituted',()=>{
  assert.throws(()=>resolveOriginalPqrsExec({hostname:qa,role:'admin',stored:'https://attacker.invalid/exec'}));
});
