import test from 'node:test';
import assert from 'node:assert/strict';
import {createSimulatedAgenda} from '../qa/agenda-simulated-service.js';

const request={actor:{id:'a',aal:'aal2'},projectId:'p',eventId:'e',version:'1',
 requestId:'r',action:'reschedule',start:'2026-11-14T10:00:00-05:00',
 end:'2026-11-14T11:00:00-05:00',confirmed:true};

function fixture(failure) {
 let event={projectId:'p',id:'e',version:'1'};
 let writes=0;
 const service=createSimulatedAgenda({
  authorize:async (actor,project)=>actor==='a' && project==='p',
  calendar:{
   get:async()=>event,
   available:async()=>failure!=='busy',
   update:async (_project,id,version,patch)=>{
    assert.equal(id,event.id);
    if(version!==event.version) throw Error('Version conflict');
    writes++;
    if(failure==='before' && writes===1) throw Error('Timeout');
    event={...event,...patch,version:String(Number(event.version)+1)};
    if(failure==='after') throw Error('Timeout');
    return event;
   }
  }
 });
 return {service,writes:()=>writes,event:()=>event};
}

test('agenda coalesces identical requests and rejects changed payloads and versions',async()=>{
 const f=fixture();
 const results=await Promise.all([f.service.run(request),f.service.run(request)]);
 assert.deepEqual(results[0],results[1]);
 assert.equal(results[0].state,'confirmed');
 assert.equal(f.writes(),1);
 await assert.rejects(f.service.run({...request,action:'cancel'}),/Idempotency conflict/);
 await assert.rejects(f.service.run({...request,requestId:'other'}),/Version conflict/);
});

test('agenda reconciles timeouts before and after the simulated update',async()=>{
 for(const failure of ['before','after']){
  const f=fixture(failure);
  assert.equal((await f.service.run(request)).state,'reconcile');
  assert.equal((await f.service.run(request)).state,'confirmed');
  assert.equal(f.writes(),failure==='before'?2:1);
 }
});

test('agenda requires authorization, confirmation and a free slot, and preserves cancelled event identity',async()=>{
 const f=fixture('busy');
 await assert.rejects(f.service.run({...request,projectId:'other'}),/Unauthorized/);
 await assert.rejects(f.service.run({...request,actor:{id:'a',aal:'aal1'}}),/Unauthorized/);
 await assert.rejects(f.service.run({...request,confirmed:false}),/Unauthorized/);
 await assert.rejects(f.service.run(request),/Schedule conflict/);
 const g=fixture();
 assert.equal((await g.service.run({...request,action:'cancel'})).eventId,'e');
 assert.equal(g.event().status,'cancelled');
});

test('agenda recovers a remote change after database close and reopen and lost SQL confirmation',async()=>{
 const {PGlite}=await import('@electric-sql/pglite');
 const {mkdtempSync, readFileSync, rmSync, writeFileSync}=await import('node:fs');
 const {tmpdir}=await import('node:os');
 const {join}=await import('node:path');
 const {createIsolatedAgendaJournal}=await import('../qa/agenda-journal-isolated.js');
 const directory=mkdtempSync(join(tmpdir(),'adphor-agenda-'));
 const eventFile=join(directory,'calendar.json');
 const database=join(directory,'db');
 let db=new PGlite(database);
 try {
  await db.exec(readFileSync(new URL('../qa/agenda-journal-isolated.sql',import.meta.url),'utf8'));
  const journal=createIsolatedAgendaJournal(db);
  writeFileSync(eventFile,JSON.stringify({id:'e',projectId:'p',version:'1',writes:0}));
  const createCalendar=()=>({
   get:async()=>JSON.parse(readFileSync(eventFile,'utf8')),
   available:async()=>true,
   update:async(_p,_id,version,patch)=>{
    const event=JSON.parse(readFileSync(eventFile,'utf8'));
    assert.equal(version,event.version);
    const updated={...event,...patch,version:'2',writes:event.writes+1};
    writeFileSync(eventFile,JSON.stringify(updated));
    return updated;
   }
  });
  const authorize=async()=>true;
  const first=createSimulatedAgenda({calendar:createCalendar(),authorize,
   journal:{...journal,confirm:async()=>{throw Error('SQL down');}}});
  assert.equal((await first.run(request)).state,'reconcile');
  await db.close();
  db=new PGlite(database);
  const restarted=createSimulatedAgenda({calendar:createCalendar(),authorize,
   journal:createIsolatedAgendaJournal(db)});
  assert.equal((await restarted.run(request)).state,'confirmed');
  assert.equal(JSON.parse(readFileSync(eventFile,'utf8')).writes,1);
  await assert.rejects(restarted.run({...request,action:'cancel'}),/Idempotency conflict/);
  assert.equal((await db.query('select count(*)::int as count from isolated_agenda_operations where result is not null')).rows[0].count,1);
 } finally {
  await db.close();
  rmSync(directory,{recursive:true,force:true});
 }
});
