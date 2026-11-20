import test from 'node:test';
import assert from 'node:assert/strict';
import {buildMissWeeklyManagementPreview} from '../src/js/services/miss-weekly-management.js';
const cutoff='2026-11-20T14:00:00.000Z';
const wrap=(authorizedPropertyIds,rows=[],more={})=>
 buildMissWeeklyManagementPreview({weekStart:'2026-11-16',cutoff,authorizedPropertyIds,rows,...more});
const row=id=>({
 project_id:id,
 tasks:{source:'public.tickets',created:1,closed:0,overdue:0},
 visits:{source:'public.qa_visits',created:2,completed:1},
 pqrs:{source:'public.pilot_pqrs',created:3,resolved:1},
 meetings:{source:'public.qa_meeting_events',registered:4}
});
test('an empty authorized set of 43 properties never becomes a false all-zero report',()=>{
 const projects=Array.from({length:43},(_,i)=>'qa-'+i);
 const r=wrap(projects);
 assert.equal(r.propertyCount,43);
 assert.equal(r.coverage.tasks,0);
 assert.equal(r.totals.tasks,null);
 assert.equal(r.totals.meetings,null);
 assert.equal(r.humanApproved,false);
 assert.equal(r.exportCertified,false);
 assert.equal(r.status,'BORRADOR_FUENTES_INCOMPLETAS');
});
test('complete scoped sources show only aggregate facts and mark an unfinished week',()=>{
 const record={...row('p1'),email:'secret@example.invalid',user_id:'PRIVATE',description:'DO NOT PRINT'};
 const r=wrap(['p1'],[record]);
 assert.equal(r.totals.tasks.created,1);
 assert.equal(r.totals.visits.completed,1);
 assert.equal(r.totals.pqrs.resolved,1);
 assert.equal(r.totals.meetings.registered,4);
 assert.equal(r.status,'BORRADOR_SEMANA_PARCIAL');
 assert.equal(r.periodPartial,true);
 assert.doesNotMatch(JSON.stringify(r),/example.invalid|PRIVATE|DO NOT PRINT/);
});
test('missing visits source preserves null not zero; available other metrics are counted',()=>{
 const one=row('a');one.visits=null;
 const r=wrap(['a'],[one]);
 assert.equal(r.coverage.visits,0);
 assert.equal(r.totals.visits,null);
 assert.equal(r.totals.tasks.created,1);
});
test('two authorized buildings consolidate only when every source covers both',()=>{
 const r=wrap(['a','b'],[row('a'),row('b')]);
 assert.equal(r.totals.pqrs.created,6);
 assert.equal(r.propertyCount,2);
 assert.equal(r.coverage.meetings,2);
});
test('reject cross-property rows, duplicates and unauthorized report scope',()=>{
 assert.throws(()=>wrap(['a'],[row('foreign')]),/fuera del alcance/);
 assert.throws(()=>wrap(['a'],[row('a'),row('a')]),/incompletas|duplicada/);
 assert.throws(()=>wrap(['a','a'],[row('a')]),/ambiguo/);
 assert.throws(()=>wrap([],[]),/ambiguo/);
});
test('invalid amounts, wrong source and overflow fail closed',()=>{
 const bad=row('a');bad.tasks={...bad.tasks,created:-1};
 assert.throws(()=>wrap(['a'],[bad]),/inválido/);
 const spoof=row('a');spoof.pqrs={...spoof.pqrs,source:'external calendar'};
 assert.throws(()=>wrap(['a'],[spoof]),/Origen semanal/);
 const big=row('a');big.tasks={...big.tasks,created:Number.MAX_SAFE_INTEGER};
 const other=row('b');other.tasks={...other.tasks,created:1};
 assert.throws(()=>wrap(['a','b'],[big,other]),/Desbordamiento/);
});
test('invalid or non-Monday week and out-of-range cutoff are rejected',()=>{
 assert.throws(()=>wrap(['a'],[],{weekStart:'2026-11-17'}),/lunes/);
 assert.throws(()=>wrap(['a'],[],{weekStart:'2026-02-30'}),/lunes/);
 assert.throws(()=>wrap(['a'],[],{cutoff:'2026-11-15T00:00:00Z'}),/corte/);
 assert.throws(()=>wrap(['a'],[],{cutoff:'2026-11-24T00:00:00Z'}),/corte/);
});
