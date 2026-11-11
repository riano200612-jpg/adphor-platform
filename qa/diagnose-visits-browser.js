import assert from 'node:assert/strict';
import {readFileSync, statfsSync} from 'node:fs';
import {freemem, totalmem, availableParallelism, loadavg} from 'node:os';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createDiagnosticStage, superviseDiagnostic} from './diagnostic-supervisor.js';
import {monitorEventLoopDelay} from 'node:perf_hooks';
import {createDiagnosticResources} from './diagnostic-resources.js';
import {startDiagnosticService} from './diagnostic-service.js';
import {bootstrapDiagnosticSql} from './diagnostic-sql-bootstrap.js';
import {chromium} from '@playwright/test';

const requestedScenario=process.argv.find(arg=>arg.startsWith('--scenario='))?.split('=')[1];
const scenario=process.argv.includes('--pglite-only')?'C':requestedScenario??'D';
assert.ok(['A','B','C','D'].includes(scenario),'Unknown diagnostic scenario');
const splitServices=process.argv.includes('--split-services');
const splitSql=splitServices||process.argv.includes('--split-sql');
const useSql=['C','D'].includes(scenario)||(scenario==='A'&&splitSql);
const useVite=['B','D'].includes(scenario);
if (process.send) {
 try {await diagnose();}
 finally {if(process.connected)process.disconnect();}
} else {
 process.exitCode=await superviseDiagnostic(fileURLToPath(import.meta.url),process.argv.slice(2));
}

async function diagnose() {
const limit=12000;
let browser, server, db;
const resources=createDiagnosticResources();
const eventLoop=monitorEventLoopDelay({resolution:20});
eventLoop.enable();
const stage=createDiagnosticStage();
const read=(path)=>{try{return readFileSync(path,'utf8').trim();}catch{return null;}};
const resourceSnapshot=point=>{
 const disk=statfsSync(process.cwd());
 let processes=[],processTree=[];
 try {
  const table=execFileSync('ps',['-eo','pid=,ppid=,comm=,pcpu=,rss='],{
   encoding:'utf8',timeout:2000
  }).trim().split('\n').map(line=>{
   const [pid,ppid,command,cpu,rss]=line.trim().split(/\s+/);
   return {pid:Number(pid),ppid:Number(ppid),command,cpuPercent:Number(cpu),rssKiB:Number(rss)};
  });
  const descendants=new Set([process.pid]);
  let changed=true;
  while(changed){
   changed=false;
   for(const item of table)if(descendants.has(item.ppid)&&!descendants.has(item.pid)){
    descendants.add(item.pid);changed=true;
   }
  }
  processTree=table.filter(item=>descendants.has(item.pid));
  processes=processTree.map(item=>item.command);
 } catch {processes=['process_snapshot_unavailable'];}
 console.log(JSON.stringify({event:'resources',scenario,splitSql,splitServices,point,eventLoop:{meanMs:Number.isFinite(eventLoop.mean)?eventLoop.mean/1e6:null,maxMs:eventLoop.max/1e6},node:process.version,arch:process.arch,
  cpus:availableParallelism(),load:loadavg(),processMemory:process.memoryUsage(),cpuUsage:process.cpuUsage(),
  memory:{free:freemem(),total:totalmem(),limit:read('/sys/fs/cgroup/memory.max'),
   current:read('/sys/fs/cgroup/memory.current')??read('/sys/fs/cgroup/memory/memory.usage_in_bytes'),events:read('/sys/fs/cgroup/memory.events'),
   cpuLimit:read('/sys/fs/cgroup/cpu.max'),cpuStat:read('/sys/fs/cgroup/cpu.stat')},
  diskFree:disk.bavail*disk.bsize,processes,processTree,
  treeRssKiB:processTree.reduce((total,item)=>total+item.rssKiB,0)}));
};
resourceSnapshot('diagnostic-start');
const person='00000000-0000-0000-0000-000000000001';
try {
 const openRepository=async()=>{
 // WASM bootstrap and SQL shutdown may block the event loop on a cold ARM64 start.
 const {PGlite}=await stage('PGlite: importación',()=>import('@electric-sql/pglite'),20000);
 await stage('PGlite: inicialización WASM',async()=>{
  db=await resources.acquire(async()=>{
   const instance=new PGlite();
   try{await instance.waitReady;return instance;}catch(error){await instance.close();throw error;}
  });
 },45000);
 await stage('PGlite: esquema y sesión sintética',async()=>{
  await bootstrapDiagnosticSql(db);
 },20000);
 return stage('Repositorio: creación',async()=>{
  const {createIsolatedVisitRepository}=await import('./isolated-visit-repository.js');
  return createIsolatedVisitRepository(db);
 });
 };
 // Keep the cold WASM initialization out of the browser/server workload.
 const childServices=[];
 const startService=async kind=>{
  const service=await resources.acquire(async()=>startDiagnosticService(kind));
  childServices.push(service);
  await service.ready;
  return service;
 };
 let repository=null;
 if(useSql){
  if(splitSql){
   const service=await stage('PGlite: proceso hijo y SQL auténtico',()=>startService('sql'),55000);
   repository={save:draft=>service.call('save',draft),list:project=>service.call('list',project)};
  }else repository=await openRepository();
 }
 if(useSql)await stage('PGlite: consulta de control antes del navegador',async()=>{
  assert.deepEqual(await repository.list('p1'),[]);
 });
 resourceSnapshot('after-sql-ready');
 if(scenario==='C')return;
 let base,moduleUrl,fixture;
 if(useVite){
 await stage('Vite: inicio local',async()=>{
  if(splitServices){
   server=await startService('vite');
   return;
  }
  const {createServer}=await import('vite');
  server=await resources.acquire(async()=>{
   const instance=await createServer({server:{host:'127.0.0.1',port:0,proxy:{},hmr:false,watch:null}});
   try{await instance.listen();return instance;}catch(error){await instance.close();throw error;}
  });
 });
 base=splitServices?(await server.ready).base:'http://127.0.0.1:'+server.httpServer.address().port+'/adphor-platform/';
 moduleUrl=base+'src/js/ui-visit-preparation.js';
 fixture=base+'visits-forensic-fixture';
 const warm=async(url,mime)=>{
  const response=await fetch(url,{signal:AbortSignal.timeout(10000),redirect:'error'});
  await response.text();
  assert.ok(response.ok,String(response.status));
  assert.match(response.headers.get('content-type')||'',mime);
 };
 await stage('Vite: primera solicitud y transformación',()=>warm(moduleUrl,/javascript/));
 await stage('Vite: segunda solicitud en caliente',()=>warm(moduleUrl,/javascript/));
 await stage('Vite: precalentar selector y CSS',async()=>{
  await warm(base+'src/js/ui-project-selector.js',/javascript/);
  await warm(base+'src/css/visits.css?direct',/css/);
 });
 }
 for(const service of childServices)console.log(JSON.stringify({event:'service-metrics',...(await service.call('metrics'))}));
 resourceSnapshot('before-chromium');
 eventLoop.reset(); // Exclude cold SQL/Vite bootstrap from launch-window delay.
 // Crostini reported a 10s launch timeout after a 41s cold WASM start.
 // Only browser launch receives 30s; the stage allows 5s for its own error cleanup.
 try {
  await stage('Chromium: launch',async()=>{
   browser=await resources.acquire(()=>chromium.launch({
    executablePath:process.env.CHROMIUM_PATH || undefined,timeout:30000
   }));
  },35000);
 } finally {
  resourceSnapshot('after-chromium-attempt');
 }
 browser.on('disconnected',()=>console.log(JSON.stringify({
  event:'chromium-disconnected',point:'browser-lifecycle'
 })));
 const browserStartupStage=async(name,action,deadline)=>{
  const started=performance.now();
  const report=point=>console.log(JSON.stringify({
   event:'chromium-startup',stage:name,point,connected:browser.isConnected(),
   elapsedMs:Math.round(performance.now()-started)
  }));
  report('before');
  resourceSnapshot('before-'+name);
  const heartbeat=setInterval(()=>report('waiting'),5000);
  try {
   // Crostini completed launch in 25.6s but context creation exceeded the
   // previous 12s stage deadline. Bound startup separately from interactions.
   return await stage(name,action,deadline);
  } finally {
   clearInterval(heartbeat);
   report('after');
   resourceSnapshot('after-'+name);
   for(const service of childServices)console.log(JSON.stringify({event:'service-metrics',point:name,...(await service.call('metrics'))}));
  }
 };
 const context=await browserStartupStage('Chromium: context',()=>resources.acquire(()=>browser.newContext()),30000);
 const page=await browserStartupStage('Chromium: page',()=>resources.acquire(()=>context.newPage()),20000);
 page.setDefaultTimeout(8000);
 page.on('pageerror',error=>console.error(JSON.stringify({event:'pageerror',error:error.message})));
 page.on('crash',()=>console.error(JSON.stringify({event:'page-crash'})));
 await stage('HTML mínimo: fill y valor',async()=>{
  await page.setContent('<label>Diagnóstico<input></label>');
  const input=page.getByLabel('Diagnóstico');
  await input.fill('Crostini');
  assert.equal(await input.inputValue(),'Crostini');
 });
 if(scenario==='A')return;
 await stage('Playwright: HTTP del módulo precalentado',async()=>{
  const response=await page.request.get(moduleUrl,{timeout:8000});
  assert.ok(response.ok(),String(response.status()));
  assert.match(response.headers()['content-type'],/javascript/);
 });
 let withSql=false;
 await stage('Playwright: registro de rutas',()=>page.route('**/*',route=>{
  if(route.request().url()===fixture){
   const adapter=withSql?',isolatedRepository:{save:window.saveVisit,list:window.listVisits}':'';
   return route.fulfill({contentType:'text/html',body:`<!doctype html><html lang="es">
   <meta name="viewport" content="width=device-width,initial-scale=1">
   <link rel="stylesheet" href="${base}src/css/visits.css?direct"><main id="visit"></main>
   <script type="module">
   import {mountVisitPreparation} from '${moduleUrl}';
   mountVisitPreparation(document.querySelector('#visit'),{projectId:'p1',projectName:'QA',
     members:[{project_id:'p1',user_id:'${person}',name:'Responsable QA'}]${adapter}});
   </script></html>`});
  }
  return route.request().url().startsWith(base)?route.continue():route.abort();
 }));
 const navigate=()=>page.goto(fixture,{waitUntil:'domcontentloaded',timeout:9000});
 await stage('Formulario sin SQL: navegación',navigate);
 const input=page.getByLabel('Tipo o motivo');
 await stage('Formulario sin SQL: render y estado',async()=>{
  await input.waitFor({state:'visible'});
  const state=await input.evaluate(el=>{
   const rect=el.getBoundingClientRect();
   const top=document.elementFromPoint(rect.x+rect.width/2,rect.y+rect.height/2);
   return {disabled:el.disabled,readOnly:el.readOnly,connected:el.isConnected,
    focused:document.activeElement===el,rect:rect.toJSON(),hit:top===el,
    hitTag:top?.tagName};
  });
  console.log(JSON.stringify({...state,visible:await input.isVisible(),
   enabled:await input.isEnabled(),editable:await input.isEditable()}));
 });
 await stage('Formulario sin SQL: fill, foco y teclado',async()=>{
  const first=await input.elementHandle();
  await input.evaluate(el=>el.addEventListener('input',()=>{el.dataset.diagnosticInputs=String(Number(el.dataset.diagnosticInputs||0)+1);}));
  try {
   await input.fill('Inspección QA',{timeout:3000});
   assert.equal(await input.inputValue(),'Inspección QA');
  } catch(error) {
   console.error(JSON.stringify({variant:'fill',error:error.message}));
   await input.focus({timeout:2000});
   await input.press('End',{timeout:2000});
   await page.keyboard.type('QA');
   console.log(JSON.stringify({variant:'keyboard',value:await input.inputValue()}));
   throw error;
  }
  await input.focus({timeout:2000});
  await input.press('End',{timeout:2000});
  await page.keyboard.type(' teclado');
  assert.equal(await input.inputValue(),'Inspección QA teclado');
  assert.equal(await first.evaluate(el=>el.isConnected),true);
  assert.ok(Number(await input.getAttribute('data-diagnostic-inputs'))>0);
 });
 if(scenario==='B')return;
 await stage('Playwright: exposeFunction',async()=>{
  await page.exposeFunction('saveVisit',draft=>repository.save(draft));
  await page.exposeFunction('listVisits',()=>repository.list('p1'));
 });
 withSql=true;
 await stage('Formulario con SQL: navegación y campos',async()=>{
  await navigate();
  await input.fill('Inspección QA');
  await page.getByLabel('Fecha y hora (Colombia)').fill('2026-11-14T10:00');
  const responsible=page.locator('#visit select[name="responsible"]');
  const filter=page.locator('#visit select[data-visit-responsible]');
  assert.equal(await responsible.count(),1,'One exclusive form responsible control');
  assert.equal(await filter.count(),1,'One exclusive listing responsible filter');
  await responsible.selectOption(person);
  assert.equal(await filter.inputValue(),'','Form selection must not change listing filter');
  await filter.selectOption(person);
  assert.equal(await responsible.inputValue(),person,'Listing filter must not change form selection');
 });
 await stage('Formulario con SQL: revisión y confirmación',async()=>{
  await page.getByRole('button',{name:'Revisar borrador'}).click();
  await page.getByRole('button',{name:'Confirmar y guardar borrador de prueba'}).click();
  await page.getByText('Borrador de prueba guardado y confirmado.').waitFor();
 });
 const id=await stage('SQL: una fila persistida',async()=>{
  const rows=await repository.list('p1');
  assert.equal(rows.length,1);
  const row=rows[0];
  const replay=await repository.save({projectId:'p1',requestId:row.request_id,responsibleId:person,kind:'Inspección QA',start:'2026-11-14T10:00'});
  assert.equal(replay.request_id,row.request_id);
  assert.equal((await repository.list('p1')).length,1);
  return row.request_id;
 });
 await stage('Formulario con SQL: consulta tras recarga',async()=>{
  await page.reload({waitUntil:'domcontentloaded',timeout:9000});
  await page.locator('[data-visit-results]').getByText(id,{exact:false}).waitFor();
  const rows=await repository.list('p1');
  assert.equal(rows.length,1);
  assert.equal(rows[0].request_id,id);
  assert.equal(rows[0].motive,'Inspección QA');
  assert.equal(rows[0].responsible_id,person);
  console.log(JSON.stringify({event:'visit-sql-after-reload',requestId:id,rows:rows.length}));
 });
} catch {
 process.exitCode=1;
} finally {
 try{await stage('Cierre: recursos y adquisiciones pendientes',()=>resources.close(),30000);}
 catch{process.exitCode=1;}
 resourceSnapshot('diagnostic-end');
 eventLoop.disable();
}
}
