import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeWeeklyPqrs} from '../src/js/ui-pqrs-weekly.js';
const good={project_id:'source-1',data_source:'public.pilot_pqrs',week_start:'2026-11-16',
 week_end_exclusive:'2026-11-23',sla_hours:24,total:3,pending:1,resolved:2,critical:1,
 manager_responded:2,without_manager_response:1,late_response:1,unanswered_over_sla:1,
 avg_first_response_hours:1,avg_resolution_hours:9,categories:[{category:'queja',count:3}],
 owner:'PERSONAL',description:'PRIVATE'};
test('per-project weekly totals and response hours normalize',()=>{
 const v=normalizeWeeklyPqrs(good,'source-1');assert.equal(v.total,3);
 assert.equal(v.avg_first_response_hours,1);assert.equal(v.categories[0].name,'queja');
});
test('free text and personal attributes never leave metrics formatter',()=>{
 const v=normalizeWeeklyPqrs(good,'source-1');
 assert.equal(v.owner,undefined);assert.equal(v.description,undefined);
});
test('cross-tenant or unrecognized source is rejected',()=>{
 assert.throws(()=>normalizeWeeklyPqrs(good,'source-2'));
 assert.throws(()=>normalizeWeeklyPqrs({...good,data_source:'Apps Script'},'source-1'));
});
test('invalid metrics are rejected',()=>{
 assert.throws(()=>normalizeWeeklyPqrs({...good,total:-1},'source-1'));
 assert.throws(()=>normalizeWeeklyPqrs({...good,avg_first_response_hours:-2},'source-1'));
});
test('empty average and categories allowed for empty week',()=>{
 const v=normalizeWeeklyPqrs({...good,avg_first_response_hours:null,categories:[]},'source-1');
 assert.equal(v.avg_first_response_hours,null);assert.deepEqual(v.categories,[]);
});
