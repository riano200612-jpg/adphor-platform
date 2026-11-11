import {fork} from 'node:child_process';
import {observeDiagnosticProcesses} from './diagnostic-process-observer.js';
import {performance} from 'node:perf_hooks';

export function superviseDiagnostic(entry,args,{idleMs=30000,graceMs=5000,report=console.error}={}) {
 return new Promise(resolve=>{
  const worker=fork(entry,args,{detached:true,stdio:['ignore','inherit','inherit','ipc']});
  const observer=args.includes('--handshake')?observeDiagnosticProcesses(worker.pid,{report}):null;
  let watchdog,escalation,reason,lastId=0;
  let active={name:'Worker: arranque',started:performance.now()};
  const signalGroup=signal=>{
   if(!worker.pid)return;
   try{process.kill(-worker.pid,signal);}catch(error){if(error.code!=='ESRCH')throw error;}
  };
  const log=(status,details)=>report(JSON.stringify({stage:'Supervisor',status,
   activeStage:active?.name??null,ms:active?Math.round(performance.now()-active.started):null,...details}));
  const stop=cause=>{
   if(reason)return;
   reason=cause;
   clearTimeout(watchdog);
   log('BLOCKED',{reason});
   signalGroup('SIGTERM');
   escalation=setTimeout(()=>signalGroup('SIGKILL'),graceMs);
  };
  const arm=ms=>{clearTimeout(watchdog);watchdog=setTimeout(()=>stop('watchdog_timeout'),ms);};
  const interrupt=()=>stop('parent_interrupted');
  for(const signal of ['SIGINT','SIGTERM'])process.once(signal,interrupt);
  arm(idleMs);
  worker.on('message',message=>{
   if(reason)return;
   if(message?.type==='stage-start'){
    if(active?.id || message.id!==lastId+1 || typeof message.name!=='string' ||
       !Number.isFinite(message.deadline) || message.deadline<=0 || message.deadline>60000){
     stop('invalid_stage_start');
     return;
    }
    lastId=message.id;
    observer?.phase(message.name);
    active={id:lastId,name:message.name,started:performance.now()};
    arm(message.deadline+graceMs);
    worker.send({type:'stage-ready',id:lastId},error=>{if(error && !worker.exitCode && !worker.signalCode)stop('ipc_ack_failed');});
   }else if(message?.type==='stage-end' && message.id===active?.id){
    active=null;
    arm(idleMs);
   }
  });
  const cleanup=()=>{
   clearTimeout(watchdog);
   clearTimeout(escalation);
   for(const signal of ['SIGINT','SIGTERM'])process.off(signal,interrupt);
  };
  worker.once('error',async error=>{
   cleanup();
   await observer?.stopAndReap({graceMs});
   log('FAIL',{reason:'worker_error',error:error.message});
   resolve(1);
  });
  worker.once('exit',async(code,signal)=>{
   cleanup();
   if(reason || signal)signalGroup('SIGKILL');
   if(signal)log('BLOCKED',{reason:reason??'external_signal',signal});
   let residual=false;
   try{residual=await observer?.stopAndReap({graceMs})??false;}catch(error){log('FAIL',{reason:'owned_process_cleanup_failed',error:error.message});residual=true;}
   resolve(reason||residual?1:code??1);
  });
 });
}

export function waitForStageReady(channel,id,message){
 return new Promise((resolve,reject)=>{
  const cleanup=()=>{
   channel.off('message',onMessage);
   channel.off('disconnect',onDisconnect);
  };
  const onMessage=reply=>{
   if(reply?.type!=='stage-ready'||reply.id!==id)return;
   cleanup();
   resolve();
  };
  const onDisconnect=()=>{
   cleanup();
   reject(Error('Canal IPC desconectado'));
  };
  channel.on('message',onMessage);
  channel.once('disconnect',onDisconnect);
  channel.send(message,error=>{
   if(error){cleanup();reject(error);}
  });
 });
}

export function createDiagnosticStage(channel=process) {
 let sequence=0;
 return async(name,action,deadline=12000)=>{
  const id=++sequence;
  const start=performance.now();
  const log=(status,details={})=>console[status==='FAIL'||status==='BLOCKED'?'error':'log'](
   JSON.stringify({stage:name,status,id,ms:Math.round(performance.now()-start),...details}));
  log('START',{deadlineMs:deadline});
  let timer;
  try {
   // The parent owns the handshake deadline. A second worker timer can expire
   // while the valid acknowledgement is queued for delivery.
   await waitForStageReady(channel,id,{type:'stage-start',id,name,deadline});
   log('READY');
   const result=await Promise.race([Promise.resolve().then(action),new Promise((_,reject)=>{
    timer=setTimeout(()=>reject(Error('Límite de etapa agotado')),deadline);
   })]);
   log('PASS');
   return result;
  }catch(error){
   const blocked=name==='Chromium: launch' && /Operation not permitted|Executable doesn't exist/.test(error.message);
   log(blocked?'BLOCKED':'FAIL',{error:error.message,causes:error instanceof AggregateError?error.errors.map(cause=>cause.message??String(cause)):undefined});
   throw error;
  }finally{
   clearTimeout(timer);
   if(channel.connected)channel.send({type:'stage-end',id},()=>{});
  }
 };
}
