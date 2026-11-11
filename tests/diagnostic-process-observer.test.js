import test from 'node:test';
import assert from 'node:assert/strict';
import {fork} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {descendantProcesses,observeDiagnosticProcesses,processIdentity} from '../qa/diagnostic-process-observer.js';
test('observer selects only the owned tree, not unrelated Chromium',()=>{
 assert.deepEqual(descendantProcesses([{pid:10,ppid:1},{pid:20,ppid:10},{pid:30,ppid:20},{pid:40,ppid:1}],10).map(x=>x.pid),[10,20,30]);
});
test('observer reaps an observed detached descendant after worker exit',async()=>{
 const worker=fork(fileURLToPath(new URL('./fixtures/diagnostic-detached-worker.js',import.meta.url)),[],{detached:true,stdio:['ignore','ignore','ignore','ipc']});
 let pid,observer;
 try{
  ({pid}=await new Promise(resolve=>worker.once('message',resolve)));
  await new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>reject(Error('observer sample deadline')),5000);
   observer=observeDiagnosticProcesses(worker.pid,{intervalMs:20,report:line=>{
    if(JSON.parse(line).tree?.some(row=>row.pid===pid)){clearTimeout(timer);resolve();}
   }});
  });
  const exited=new Promise(resolve=>worker.once('exit',resolve));worker.send('exit');await exited;
  assert.equal(await observer.stopAndReap({graceMs:200}),true);
  const identity=await processIdentity(pid);
  assert.ok(!identity||identity.state.startsWith('Z'),'owned process must not remain running');
 }finally{
  await observer?.stopAndReap({graceMs:100});
  if(worker.exitCode===null)worker.kill('SIGKILL');
  if(pid){try{process.kill(-pid,'SIGKILL');}catch{}}
 }
});
