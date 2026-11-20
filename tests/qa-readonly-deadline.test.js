import test from 'node:test';
import assert from 'node:assert/strict';
import {readWithinDeadline,QaReadTimeoutError,qaMeetingReadFeedback} from '../src/js/services/qa-readonly-deadline.js';

test('GAUNTLET: verified meetings read finishes normally without altering its rows',async()=>{
 const rows=[{id:'qa-meeting-1',project_id:'source-28'}];
 const result=await readWithinDeadline(async()=>rows,{timeoutMs:1000});
 assert.strictEqual(result,rows);
});
test('GAUNTLET: an indefinitely pending meetings read has a bounded wait and clear retry',async()=>{
 const start=Date.now();
 await assert.rejects(()=>readWithinDeadline(()=>new Promise(()=>{}),{timeoutMs:20}),QaReadTimeoutError);
 assert.ok(Date.now()-start>=10);
 assert.match(qaMeetingReadFeedback(new QaReadTimeoutError()),/Actualizar datos/);
 assert.doesNotMatch(qaMeetingReadFeedback(new QaReadTimeoutError()),/verificadas.*[0-9]+/);
});
test('GAUNTLET: real service errors remain errors; no fabricated meeting is returned',async()=>{
 const error=new Error('Servicio no disponible');
 await assert.rejects(()=>readWithinDeadline(()=>Promise.reject(error),{timeoutMs:1000}),error);
 assert.match(qaMeetingReadFeedback(error),/No se pudieron consultar/);
});
test('GAUNTLET: reject bad task and deadlines before starting any query',()=>{
 assert.throws(()=>readWithinDeadline(null),/Parámetros/);
 assert.throws(()=>readWithinDeadline(()=>[],{timeoutMs:0}),/Parámetros/);
 assert.throws(()=>readWithinDeadline(()=>[],{timeoutMs:60001}),/Parámetros/);
});
