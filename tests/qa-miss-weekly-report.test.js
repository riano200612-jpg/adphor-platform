import test from 'node:test';import assert from 'node:assert/strict';
import {missQaCurrentWeek,summarizeMissQaWeek,qaMissWeeklyReader} from '../src/js/services/qa-miss-weekly-report.js';
import {missQaWeeklyCsv} from '../src/js/ui-miss-qa-weekly.js';
const now=Date.parse('2026-11-20T14:00:00Z'),weekStart='2026-11-16',projectIds=['source-1'];
const sources={tasks:[{project_id:'source-1',created_at:'2026-11-19T10:00:00Z',status:'Pendiente',due_date:'2026-11-18'}],visits:[{project_id:'source-1',created_at:'2026-11-18T09:00:00Z',finished_at:null,status:'programada'}],pqrs:[{project_id:'source-1',created_at:'2026-11-19T10:00:00Z',closed_at:null}],meetings:[{project_id:'source-1',start_at:'2026-11-20T09:00:00Z',is_calendar_verified:true}]};
test('Miss computes Colombia work week and verifies available sources without invented completion',()=>{
 assert.equal(missQaCurrentWeek(now),weekStart);
 const r=summarizeMissQaWeek({now,weekStart,projectIds,sources});
 assert.equal(r.totals.tasksCreated,1);assert.equal(r.totals.tasksOverdueAtCutoff,1);
 assert.equal(r.totals.visitsRegistered,1);assert.equal(r.totals.pqrsNew,1);assert.equal(r.totals.meetingsImported,1);
 assert.equal(r.coverage.tasks,0);assert.equal(r.approved,false);assert.equal(r.modelsReady,false);
});
test('unknown sources remain NO DISPONIBLE, never zero',()=>{
 const r=summarizeMissQaWeek({now,weekStart,projectIds,sources:{...sources,pqrs:null,tasks:null}});
 assert.equal(r.totals.tasksCreated,null);assert.equal(r.totals.pqrsNew,null);
 assert.equal(r.totals.visitsFinished,0);
 assert.match(missQaWeeklyCsv(r,[{id:'source-1',name:'=LINK(\"unsafe\")'}]),/'=LINK/);
});
test('foreign tenants, duplicated projects and invalid dates reject before output',()=>{
 assert.throws(()=>summarizeMissQaWeek({now,weekStart,projectIds,sources:{...sources,tasks:[{project_id:'foreign'}]}}),/ajenos/);
 assert.throws(()=>summarizeMissQaWeek({now,weekStart,projectIds:['source-1','source-1'],sources}),/Ámbito/);
 assert.throws(()=>summarizeMissQaWeek({now,weekStart:'2026-11-17',projectIds,sources}),/lunes/);
});
test('wrong host, AAL1 and unauthorized building fail before any source data reads',async()=>{
 let calls=0;const members=[{project_id:'source-1',role:'admin'}];
 const client={auth:{getUser:async()=>({data:{user:{id:'u1'}}}),mfa:{getAuthenticatorAssuranceLevel:async()=>({data:{currentLevel:'aal1'}})}},
  from:table=>{calls++;assert.equal(table,'memberships');return {select(){return {eq(){return Promise.resolve({data:members,error:null});}}}};}};
 const options={url:'https://qfctnnnnltghepwujpdm.supabase.co',hostname:'qa-integral-claude-reviewed.adphor-platform.pages.dev',getActor:()=>({id:'u1'}),now:()=>now};
 const read=qaMissWeeklyReader(client,options);
 await assert.rejects(read({weekStart,projectIds}),/AAL2/);assert.equal(calls,0);
 client.auth.mfa.getAuthenticatorAssuranceLevel=async()=>({data:{currentLevel:'aal2'}});
 await assert.rejects(read({weekStart,projectIds:['source-2']}),/no está autorizada/);
 assert.equal(calls,1);
 const wrong=qaMissWeeklyReader(client,{...options,hostname:'adphor-platform.pages.dev'});
 await assert.rejects(wrong({weekStart,projectIds}),/QA Integral/);
});
