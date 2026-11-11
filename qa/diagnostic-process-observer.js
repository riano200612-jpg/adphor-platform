import {execFile} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {promisify} from 'node:util';
const exec=promisify(execFile);
const read=async path=>{try{return (await readFile(path,'utf8')).trim();}catch{return null;}};
export async function processIdentity(pid){
 const stat=await read('/proc/'+pid+'/stat');
 if(!stat)return null;
 const fields=stat.slice(stat.lastIndexOf(')')+2).split(/\s+/);
 return {state:fields[0],group:Number(fields[2]),start:fields[19]};
}
export function descendantProcesses(table,root){
 const ids=new Set([root]);let changed=true;
 while(changed){changed=false;for(const row of table)if(ids.has(row.ppid)&&!ids.has(row.pid)){ids.add(row.pid);changed=true;}}
 return table.filter(row=>ids.has(row.pid));
}

// Runs in the independent supervisor, never on PGlite's or Playwright's event loop.
export function observeDiagnosticProcesses(root,{report=console.error,intervalMs=2000}={}){
 const owned=new Map();let stopped=false,pending=Promise.resolve(),phase='startup';
 const sample=async()=>{
  try{
   const {stdout}=await exec('ps',['-eo','pid=,ppid=,pgid=,stat=,pcpu=,rss=,wchan=,comm='],{timeout:1500,maxBuffer:1024*1024});
   const table=stdout.trim().split('\n').map(line=>{
    const [pid,ppid,group,state,cpu,rss,wchan,...command]=line.trim().split(/\s+/);
    return {pid:Number(pid),ppid:Number(ppid),group:Number(group),state,cpuPercent:Number(cpu),rssKiB:Number(rss),wchan,command:command.join(' ')};
   });
   const tree=descendantProcesses(table,root);
   for(const row of tree){
    const identity=await processIdentity(row.pid);
    if(identity)owned.set(row.pid,{...identity,pid:row.pid});
   }
   report(JSON.stringify({event:'independent-process-sample',phase,root,tree,
    pressure:{cpu:await read('/proc/pressure/cpu'),memory:await read('/proc/pressure/memory'),io:await read('/proc/pressure/io')},
    cgroup:{memoryCurrent:await read('/sys/fs/cgroup/memory.current')??await read('/sys/fs/cgroup/memory/memory.usage_in_bytes'),
     memoryLimit:await read('/sys/fs/cgroup/memory.max')??await read('/sys/fs/cgroup/memory/memory.limit_in_bytes'),
     cpuStat:await read('/sys/fs/cgroup/cpu.stat')??await read('/sys/fs/cgroup/cpu/cpu.stat')}}));
  }catch(error){report(JSON.stringify({event:'independent-process-sample',phase,error:error.message}));}
 };
 const tick=()=>{pending=pending.then(()=>stopped?undefined:sample());};
 const timer=setInterval(tick,intervalMs);tick();
 const live=async()=>{
  const result=[];
  for(const item of owned.values()){
   const now=await processIdentity(item.pid);
   // PID reuse must never authorize a signal. Ignore zombies, which cannot run.
   if(now&&now.start===item.start&&now.group===item.group&&!now.state.startsWith('Z'))result.push(item);
  }
  return result;
 };
 return {
  phase(name){phase=name;},
  async stopAndReap({graceMs=5000}={}){
   clearInterval(timer);stopped=true;await pending;
   const remaining=await live();
   if(!remaining.length)return false;
   const signal=async kind=>{
    for(const group of new Set((await live()).map(item=>item.group))){
     // Only groups containing a verified, previously observed descendant.
     try{process.kill(-group,kind);}catch(error){if(error.code!=='ESRCH')throw error;}
    }
   };
   report(JSON.stringify({event:'owned-process-cleanup',status:'FAIL',pids:remaining.map(item=>item.pid),reason:'processes_alive_after_worker_exit'}));
   await signal('SIGTERM');
   const deadline=Date.now()+graceMs;
   while((await live()).length&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,25));
   if((await live()).length){
    await signal('SIGKILL');
    const verifyDeadline=Date.now()+1000;
    while((await live()).length&&Date.now()<verifyDeadline)await new Promise(resolve=>setTimeout(resolve,25));
   }
   const survivors=await live();
   if(survivors.length)throw Error('Observed diagnostic processes still running: '+survivors.map(item=>item.pid).join(','));
   return true;
  }
 };
}
