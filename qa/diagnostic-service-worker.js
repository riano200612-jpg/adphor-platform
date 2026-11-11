import {createDiagnosticResources} from './diagnostic-resources.js';
import {bootstrapDiagnosticSql} from './diagnostic-sql-bootstrap.js';
import {monitorEventLoopDelay} from 'node:perf_hooks';
const kind=process.argv[2];
const resources=createDiagnosticResources();
const loop=monitorEventLoopDelay({resolution:20});loop.enable();
let closing=false,queue=Promise.resolve();
const send=message=>{if(process.connected)process.send(message,()=>{});};
const close=async()=>{
 if(closing)return;closing=true;
 try{await queue;await resources.close();}catch(error){
  process.exitCode=1;
  console.error(JSON.stringify({event:'service-cleanup-error',kind,error:error.message,causes:error instanceof AggregateError?error.errors.map(cause=>cause.message):undefined}));
 }
 finally{loop.disable();if(process.connected)process.disconnect();}
};
process.once('SIGTERM',close);process.once('disconnect',close);
try{
 let repository,metadata={kind,pid:process.pid};
 if(kind==='sql'){
  const {PGlite}=await import('@electric-sql/pglite');
  const db=await resources.acquire(async()=>{
   const instance=new PGlite();
   try{await instance.waitReady;return instance;}catch(error){await instance.close();throw error;}
  });
  await bootstrapDiagnosticSql(db);
  const {createIsolatedVisitRepository}=await import('./isolated-visit-repository.js');
  repository=createIsolatedVisitRepository(db);
 }else if(kind==='vite'){
  const {createServer}=await import('vite');
  const server=await resources.acquire(async()=>{
   const instance=await createServer({server:{host:'127.0.0.1',port:0,proxy:{},hmr:false,watch:null}});
   try{await instance.listen();return instance;}catch(error){await instance.close();throw error;}
  });
  metadata.base='http://127.0.0.1:'+server.httpServer.address().port+'/adphor-platform/';
 }else throw Error('Unknown isolated service');
 process.on('message',message=>{
  if(message?.type!=='request'||closing)return;
  queue=queue.then(async()=>{
   try{
    let value;
    if(message.method==='metrics')value={pid:process.pid,memory:process.memoryUsage(),cpu:process.cpuUsage(),loopMaxMs:loop.max/1e6};
    else if(kind==='sql'&&message.method==='list')value=await repository.list(message.payload);
    else if(kind==='sql'&&message.method==='save')value=await repository.save(message.payload);
    else throw Error('Method not permitted');
    send({type:'result',id:message.id,value});
   }catch(error){send({type:'result',id:message.id,error:error.message});}
  });
 });
 if(!closing)send({type:'ready',metadata});
}catch(error){send({type:'startup-error',error:error.message});process.exitCode=1;await close();}
