import {fork} from 'node:child_process';
import {fileURLToPath} from 'node:url';

// Child remains in the diagnostic supervisor's process group. Never detach it.
export function startDiagnosticService(kind,{entry=new URL('./diagnostic-service-worker.js',import.meta.url),readyMs=55000}={}) {
 if(!['sql','vite'].includes(kind))throw Error('Unknown isolated service');
 const child=fork(fileURLToPath(entry),[kind],{stdio:['ignore','inherit','inherit','ipc']});
 let sequence=0,closing=false,closePromise,readyTimer;
 const pending=new Map();
 let resolveReady,rejectReady;
 const ready=new Promise((resolve,reject)=>{resolveReady=resolve;rejectReady=reject;});
 // Observe startup even when cancellation precedes readiness.
 ready.catch(()=>{});
 const rejectAll=error=>{
  clearTimeout(readyTimer);rejectReady(error);
  for(const item of pending.values()){clearTimeout(item.timer);item.reject(error);}
  pending.clear();
 };
 const exited=new Promise(resolve=>child.once('exit',(code,signal)=>{
  rejectAll(Error(`Isolated ${kind} exited (${code??signal})`));resolve();
 }));
 child.once('error',rejectAll);
 child.on('message',message=>{
  if(message?.type==='ready'){clearTimeout(readyTimer);resolveReady(message.metadata);}
  if(message?.type==='startup-error')rejectAll(Error(message.error));
  if(message?.type!=='result')return;
  const item=pending.get(message.id);if(!item)return;
  pending.delete(message.id);clearTimeout(item.timer);
  if(message.error)item.reject(Error(message.error));else item.resolve(message.value);
 });
 readyTimer=setTimeout(()=>rejectAll(Error(`Isolated ${kind} readiness deadline`)),readyMs);
 const service={pid:child.pid,ready,
  call(method,payload){
   if(closing)return Promise.reject(Error('Isolated service is closing'));
   return new Promise((resolve,reject)=>{
    const id=++sequence;
    const timer=setTimeout(()=>{pending.delete(id);reject(Error('Isolated SQL request deadline'));},10000);
    pending.set(id,{resolve,reject,timer});
    child.send({type:'request',id,method,payload},error=>{
     if(!error)return;clearTimeout(timer);pending.delete(id);reject(error);
    });
   });
  },
  close(){
   if(closePromise)return closePromise;
   closing=true;rejectAll(Error('Isolated service is closing'));
   closePromise=(async()=>{
    const started=performance.now();
    // SIGTERM asks the child to close even if it is still initializing.
    if(child.exitCode===null&&child.signalCode===null)child.kill('SIGTERM');
    let forced=false;
    const kill=setTimeout(()=>{forced=true;child.kill('SIGKILL');},5000);
    try{await exited;}finally{
     clearTimeout(kill);
     console.log(JSON.stringify({event:'service-cleanup',kind,pid:child.pid,forced,exitCode:child.exitCode,signal:child.signalCode,ms:Math.round(performance.now()-started)}));
    }
    if(forced)throw Error(`Isolated ${kind} required SIGKILL during cleanup`);
    if(child.exitCode!==null&&child.exitCode!==0)throw Error(`Isolated ${kind} cleanup exited with code ${child.exitCode}`);
   })();
   return closePromise;
  }
 };
 // Own the raw process immediately, before awaiting readiness (H3).
 return service;
}
