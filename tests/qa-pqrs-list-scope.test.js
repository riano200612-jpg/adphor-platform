import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyPqrsListScope} from '../src/js/services/qa-pqrs-list-scope.js';

const c=(id='CASE-1',project_id='building-a',status='open')=>({
 id,project_id,status,subject:'Novedad de prueba',description:'Caso sintético sin datos reales'
});
test('GAUNTLET PQRS: correct selected building and authorized status pass',()=>{
 const result=verifyPqrsListScope([c('A'),c('B','building-a','closed')],'building-a');
 assert.equal(result.length,2);
 assert.equal(verifyPqrsListScope([c('A')],'building-a','open').length,1);
 assert.deepEqual(verifyPqrsListScope([],'building-a'),[]);
});
test('GAUNTLET PQRS: foreign building is rejected even if one valid row exists',()=>{
 assert.throws(()=>verifyPqrsListScope([c('A'),c('B','building-b')],'building-a'),/ajeno/);
 assert.throws(()=>verifyPqrsListScope([c('B','building-b')],'building-a'),/ajeno/);
});
test('GAUNTLET PQRS: duplicate case IDs fail closed',()=>{
 assert.throws(()=>verifyPqrsListScope([c('A'),c('A')],'building-a'),/repetido/);
});
test('GAUNTLET PQRS: malformed, excessive or incomplete response fails',()=>{
 assert.throws(()=>verifyPqrsListScope(null,'building-a'),/formato/);
 assert.throws(()=>verifyPqrsListScope([null],'building-a'),/incompleto/);
 assert.throws(()=>verifyPqrsListScope([c('', 'building-a')],'building-a'),/incompleto/);
 assert.throws(()=>verifyPqrsListScope([{...c(),subject:''}],'building-a'),/incompleto/);
 assert.throws(()=>verifyPqrsListScope([{...c(),description:null}],'building-a'),/incompleto/);
 assert.throws(()=>verifyPqrsListScope(Array(201).fill(c()),'building-a'),/formato/);
});
test('GAUNTLET PQRS: reject wrong filter and unscoped tenant input',()=>{
 assert.throws(()=>verifyPqrsListScope([c('A','building-a','closed')],'building-a','open'),/ajeno/);
 assert.throws(()=>verifyPqrsListScope([c()],'building-a','delivered'),/filtro/);
 assert.throws(()=>verifyPqrsListScope([c()],' '),/copropiedad/);
});
