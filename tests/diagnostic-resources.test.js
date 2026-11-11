import test from 'node:test';
import assert from 'node:assert/strict';
import {createDiagnosticResources} from '../qa/diagnostic-resources.js';

test('late resource after simulated deadline is closed exactly once',async()=>{
 const scope=createDiagnosticResources();
 let finish,closes=0;
 const acquired=scope.acquire(()=>new Promise(resolve=>{finish=resolve;}));
 await Promise.resolve();
 const rejected=assert.rejects(acquired,/after diagnostic shutdown/);
 const cleanup=scope.close();
 finish({close:async()=>{closes++;}});
 await cleanup;
 await rejected;
 await scope.close();
 assert.equal(closes,1);
 await assert.rejects(scope.acquire(()=>{}),/already closing/);
});

test('cleanup observes late acquisition errors without an unhandled rejection',async()=>{
 const scope=createDiagnosticResources();
 let fail;
 const acquired=scope.acquire(()=>new Promise((_resolve,reject)=>{fail=reject;}));
 await Promise.resolve();
 const rejected=assert.rejects(acquired,/launch failed/);
 const cleanup=scope.close();
 fail(Error('launch failed'));
 await rejected;
 await cleanup;
});

test('normal resources close once and other resources close despite a failure',async()=>{
 const scope=createDiagnosticResources();
 let closes=0;
 await scope.acquire(async()=>({close:async()=>{throw Error('close failure');}}));
 await scope.acquire(async()=>({close:async()=>{closes++;}}));
 await assert.rejects(scope.close(),/cleanup failed/);
 await assert.rejects(scope.close(),/cleanup failed/);
 assert.equal(closes,1);
});

test('stage timeout cleans a late browser, context or page without publishing it',async()=>{
 const {EventEmitter}=await import('node:events');
 const {createDiagnosticStage}=await import('../qa/diagnostic-supervisor.js');
 for(const resourceType of ['browser','context','page']){
  const channel=new EventEmitter();
  channel.connected=true;
  channel.send=(message,callback)=>{
   if(message.type==='stage-start')queueMicrotask(()=>channel.emit('message',{type:'stage-ready',id:message.id}));
   callback?.(null);
  };
  const scope=createDiagnosticResources();
  const stage=createDiagnosticStage(channel);
  let finish,closes=0,published=false;
  await assert.rejects(stage('late '+resourceType,async()=>{
   const resource=await scope.acquire(()=>new Promise(resolve=>{finish=resolve;}));
   published=true;
   return resource;
  },5),/Límite de etapa/);
  const cleanup=scope.close();
  finish({close:async()=>{closes++;}});
  await cleanup;
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(closes,1);
  assert.equal(published,false);
 }
});

test('late real process resource is reaped after acquisition deadline',async()=>{
 const {spawn}=await import('node:child_process');
 const scope=createDiagnosticResources();
 let finish;
 const acquisition=scope.acquire(()=>new Promise(resolve=>{finish=resolve;}));
 await Promise.resolve();
 const rejected=assert.rejects(acquisition,/after diagnostic shutdown/);
 const cleanup=scope.close();
 const child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});
 const exited=new Promise(resolve=>child.once('exit',resolve));
 finish({close:async()=>{child.kill('SIGTERM');await exited;}});
 await cleanup;await rejected;
 assert.throws(()=>process.kill(child.pid,0),{code:'ESRCH'});
});

test('blocked page close cannot prevent browser or independent service shutdown',async()=>{
 const scope=createDiagnosticResources();
 let releasePage,finishLatePage;
 let browserCloses=0,serviceCloses=0;
 const pageClosed=new Promise(resolve=>{releasePage=resolve;});
 await scope.acquire(async()=>({close:async()=>{serviceCloses++;}}));
 await scope.acquire(async()=>({close:async()=>{
  browserCloses++;releasePage();finishLatePage?.({close:async()=>{}});
 }}));
 await scope.acquire(async()=>({close:()=>pageClosed}));
 const pending=scope.acquire(()=>new Promise(resolve=>{finishLatePage=resolve;}));
 await Promise.resolve();
 const rejected=assert.rejects(pending,/after diagnostic shutdown/);
 // Without concurrent close initiation, pageClosed would wait forever for browser.
 await Promise.race([scope.close(),new Promise((_,reject)=>{
  const timer=setTimeout(()=>reject(Error('cleanup deadlock')),1000);timer.unref();
 })]);
 await rejected;
 await scope.close();
 assert.equal(browserCloses,1);assert.equal(serviceCloses,1);
});
