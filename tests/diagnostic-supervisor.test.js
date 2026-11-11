import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {fileURLToPath} from 'node:url';
import {superviseDiagnostic,waitForStageReady} from '../qa/diagnostic-supervisor.js';

test('IPC ignores an old confirmation and accepts the matching ID',async()=>{
 const channel=new EventEmitter();
 channel.send=(_message,callback)=>callback(null);
 let confirmed=false;
 const ready=waitForStageReady(channel,2,{}).then(()=>{confirmed=true;});
 channel.emit('message',{type:'stage-ready',id:1});
 await Promise.resolve();
 assert.equal(confirmed,false);
 channel.emit('message',{type:'stage-ready',id:2});
 await ready;
 assert.equal(confirmed,true);
 assert.equal(channel.listenerCount('message'),0);
});

const entry=fileURLToPath(new URL('./fixtures/diagnostic-ipc-worker.js',import.meta.url));
test('IPC acknowledges rapid stages and controlled waiting without escalation',async()=>{
 const logs=[];
 assert.equal(await superviseDiagnostic(entry,[],{report:line=>logs.push(line)}),0);
 assert.deepEqual(logs,[]);
});

test('supervisor stops a blocked worker and records its active stage',async()=>{
 const logs=[];
 assert.equal(await superviseDiagnostic(entry,['--block'],{
  idleMs:5000,graceMs:200,report:line=>logs.push(JSON.parse(line))
 }),1);
 assert.equal(logs[0].reason,'watchdog_timeout');
 assert.equal(logs[0].activeStage,'Bloqueo sintético');
 assert.ok(logs[0].ms>=100);
});

test('diagnostic stage returns the action instance and propagates errors',async()=>{
 const {createDiagnosticStage}=await import('../qa/diagnostic-supervisor.js');
 const channel=new EventEmitter();
 channel.connected=true;
 channel.send=(message,callback)=>{
  if(message.type==='stage-start')queueMicrotask(()=>channel.emit('message',{type:'stage-ready',id:message.id}));
  callback?.(null);
 };
 const stage=createDiagnosticStage(channel);
 const browserLike={newContext:()=>({})};
 assert.equal(await stage('return instance',async()=>browserLike),browserLike);
 await assert.rejects(stage('propagate error',async()=>{throw Error('controlled failure');}),/controlled failure/);
 assert.equal(channel.listenerCount('message'),0);
});
