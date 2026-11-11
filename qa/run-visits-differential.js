import {summarizeChromiumHandshake} from './chromium-handshake-evidence.js';
import {spawn,execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {performance} from 'node:perf_hooks';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';

const bd=process.argv.includes('--bd');
const directory=resolve(process.argv.slice(2).find(arg=>!arg.startsWith('--'))??'test-results/visits-differential-'+Date.now());
mkdirSync(directory,{recursive:true});
const entry=fileURLToPath(new URL('./diagnose-visits-browser.js',import.meta.url));
const results=[];
// Rotate the scenario that starts each round instead of grouping all A runs first.
const variants={A:{scenario:'A',args:['--handshake']},'A-sql-child':{scenario:'A',args:['--split-sql','--handshake']},B:{scenario:'B',args:[]},D:{scenario:'D',args:[]},
 'D-sql-child':{scenario:'D',args:['--split-sql']},
 'D-services-child':{scenario:'D',args:['--split-services']}};
const focus=process.argv.find(arg=>arg.startsWith('--focus='))?.slice('--focus='.length);
if(focus&&!Object.hasOwn(variants,focus))throw Error('Unknown focused variant');
const launchPair=process.argv.includes('--launch-pair');
const handshake=launchPair||process.argv.includes('--handshake');
const orders=launchPair?[['A','A-sql-child']]:focus?[[focus]]:bd?
 [['B','D','D-sql-child','D-services-child'],['D','D-services-child','B','D-sql-child'],['D-sql-child','B','D-services-child','D']]:
 [['A','B','C','D'],['B','C','D','A'],['C','D','A','B']];
for(let round=0;round<orders.length;round++){
 for(const variant of orders[round]){
  const {scenario,args}=variants[variant]??{scenario:variant,args:[]};
  const repetition=round+1;
  const startedAt=new Date().toISOString();
  const started=performance.now();
  const outcome=await new Promise(resolveRun=>{
   const child=spawn(process.execPath,[entry,'--scenario='+scenario,...args,...(handshake&&!args.includes('--handshake')?['--handshake']:[])],{stdio:['ignore','pipe','pipe'],env:{...process.env,...(handshake?{DEBUG:'pw:browser,pw:protocol'}:{})}});
   let stdout='',stderr='';
   child.stdout.on('data',data=>{stdout+=data;});
   child.stderr.on('data',data=>{stderr+=data;});
   child.once('error',error=>resolveRun({code:null,signal:null,stdout,stderr:stderr+error.message}));
   child.once('close',(code,signal)=>resolveRun({code,signal,stdout,stderr}));
  });
  const parse=stream=>stream.split('\n').filter(Boolean).map(line=>{
   try{return JSON.parse(line);}catch{return {event:'non-json-output',text:line};}
  });
  const events=[...parse(outcome.stdout),...parse(outcome.stderr)];
  writeFileSync(join(directory,variant+'-'+repetition+'.json'),JSON.stringify({scenario,variant,repetition,...outcome,events},null,2));
  const resources=events.filter(event=>event.event==='resources');
  const failures=events.filter(event=>['FAIL','BLOCKED'].includes(event.status));
  const stages=events.filter(event=>['PASS','FAIL','BLOCKED'].includes(event.status));
  // Observe only PIDs recorded for this run; never signal unrelated user processes.
  const known=new Set(resources.flatMap(event=>event.processTree?.map(process=>process.pid)??[]));
  let residual=[];
  try{
   residual=execFileSync('ps',['-eo','pid=,comm='],{encoding:'utf8',timeout:2000})
    .trim().split('\n').map(line=>line.trim().split(/\s+/)).filter(([pid])=>known.has(Number(pid)));
  }catch{residual=[['unknown','ps unavailable']];}
  const result={scenario,variant,repetition,startedAt,sequence:results.length+1,status:failures.some(event=>event.status==='BLOCKED')?'BLOCKED':
   outcome.code===0&&failures.length===0?'PASS':'FAIL',exitCode:outcome.code,signal:outcome.signal,
   elapsedMs:Math.round(performance.now()-started),stages,resources,handshake:summarizeChromiumHandshake(outcome.stderr),residualProcesses:residual};
  results.push(result);
  console.log(JSON.stringify(result));
  if(launchPair&&results.length===2){
   if(results.every(item=>item.status==='PASS'&&!item.residualProcesses.length))orders[0].push('D-sql-child');
   else console.log(JSON.stringify({event:'functional-run',status:'SKIPPED',reason:'Chromium preflight did not pass both controls'}));
  }
 }
}
writeFileSync(join(directory,'results.json'),JSON.stringify(results,null,2));
console.log(JSON.stringify({event:'report',directory,runs:results.length}));
if(results.some(result=>result.status!=='PASS'||result.residualProcesses.length))process.exitCode=1;
