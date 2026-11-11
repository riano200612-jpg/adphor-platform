import test from 'node:test';
import assert from 'node:assert/strict';
import {startDiagnosticService} from '../qa/diagnostic-service.js';
import {diagnosticPerson} from '../qa/diagnostic-sql-bootstrap.js';

test('SQL child persists real rows, rejects cross-project and conflicting retries, exits cleanly',async()=>{
 const service=startDiagnosticService('sql');
 try{
  const metadata=await service.ready;
  assert.notEqual(metadata.pid,process.pid);
  assert.deepEqual(await service.call('list','p1'),[]);
  const draft={projectId:'p1',requestId:'11111111-1111-4111-8111-111111111111',responsibleId:diagnosticPerson,kind:'Inspección QA',start:'2026-11-14T10:00'};
  const rows=await Promise.all([service.call('save',draft),service.call('save',draft)]);
  assert.equal(rows[0].request_id,rows[1].request_id);
  assert.equal((await service.call('list','p1')).length,1);
  await assert.rejects(service.call('save',{...draft,kind:'Otro motivo'}));
  await assert.rejects(service.call('save',{...draft,projectId:'p2'}));
  assert.deepEqual(await service.call('list','p2'),[]);
  await assert.rejects(service.call('exec','drop table memberships'),/not permitted/);
  assert.ok((await service.call('metrics')).memory.rss>0);
 }finally{await service.close();await service.close();}
 assert.throws(()=>process.kill(service.pid,0),{code:'ESRCH'});
 await assert.rejects(service.call('list','p1'),/closing/);
});

test('service shutdown before SQL readiness reaps the child without unhandled rejection',async()=>{
 const service=startDiagnosticService('sql');
 await service.close();
 await assert.rejects(service.ready);
 assert.throws(()=>process.kill(service.pid,0),{code:'ESRCH'});
});

test('Vite isolated process serves actual transformed UI and is reaped',async()=>{
 const service=startDiagnosticService('vite');
 try{
  const {base}=await service.ready;
  const response=await fetch(base+'src/js/ui-visit-preparation.js',{signal:AbortSignal.timeout(10000)});
  assert.equal(response.status,200);
  assert.match(await response.text(),/mountVisitPreparation/);
 }finally{await service.close();}
 assert.throws(()=>process.kill(service.pid,0),{code:'ESRCH'});
});

test('nonzero child shutdown is reported as cleanup failure and still reaped',async()=>{
 const service=startDiagnosticService('sql',{entry:new URL('./fixtures/diagnostic-failing-close.js',import.meta.url)});
 await service.ready;
 await assert.rejects(service.close(),/cleanup exited with code 2/);
 assert.throws(()=>process.kill(service.pid,0),{code:'ESRCH'});
});
