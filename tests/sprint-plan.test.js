import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sprintWindow,buildSprintPlan} from '../src/js/services/sprint-plan.js';
import {renderSprintBoard} from '../src/js/ui-sprint-board.js';

const base={projectId:'p1',userId:'admin-1',role:'admin',asOf:'2026-11-19'};
const item=(id,due_date,patch={})=>({id,title:'Tarea '+id,project_id:'p1',
 assignee:'admin-1',due_date,status:'Pendiente',area:'Común',priority:'Media',...patch});

test('fortnight is anchored to December and precisely fourteen days across year boundary',()=>{
 assert.deepEqual(sprintWindow({asOf:'2026-11-19'}),{start:'2026-11-17',end:'2026-11-30',cycle:-1,days:14});
 assert.deepEqual(sprintWindow({asOf:'2026-11-19',offset:1}),{start:'2026-12-01',end:'2026-12-14',cycle:0,days:14});
 assert.deepEqual(sprintWindow({asOf:'2026-12-31'}),{start:'2026-12-29',end:'2027-01-11',cycle:2,days:14});
 assert.throws(()=>sprintWindow({asOf:'2026-02-30'}));
 assert.throws(()=>sprintWindow({offset:100000}));
});
test('user scope and authorized team scope are isolated by assignee and property',()=>{
 const rows=[item('mine','2026-11-18'),item('other','2026-11-19',{assignee:'operator'}),
  item('foreign','2026-11-21',{project_id:'p2'}),item('closed','2026-11-22',{status:'Cerrada'})];
 const mine=buildSprintPlan(rows,base);
 assert.deepEqual(mine.inside.map(z=>z.id),['mine','closed']);
 assert.equal(mine.summary.closed,1);
 const team=buildSprintPlan(rows,{...base,scope:'team'});
 assert.deepEqual(team.inside.map(z=>z.id),['mine','other','closed']);
 assert.ok(!renderSprintBoard(rows,{...base,scope:'team'}).includes('foreign'));
 assert.throws(()=>buildSprintPlan(rows,{...base,role:'viewer',scope:'team'}),/coordinador/);
 assert.throws(()=>buildSprintPlan(rows,{...base,role:'technician',scope:'team'}),/coordinador/);
 const html=renderSprintBoard(rows,{...base,role:'viewer'});
 assert.ok(!html.includes('Equipo de la copropiedad'));
 assert.ok(!html.includes('Tarea other'));
});
test('closed old tasks never appear as carryover; invalid inputs never masquerade as valid',()=>{
 const rows=[item('late','2026-11-16'),item('past-closed','2026-11-15',{status:'Cerrada'}),
 item('future','2026-12-01'),item('invalid','2026-02-30'),item('duplicated','2026-11-17'),
 item('duplicated','2026-11-18')];
 const plan=buildSprintPlan(rows,base);
 assert.equal(plan.carryover.length,1);
 assert.equal(plan.inside.length,1);
 assert.equal(plan.later.length,1);
 assert.equal(plan.invalid,2);
 assert.equal(plan.source,'persisted-tickets');
 assert.equal(plan.readonly,true);
});
test('HTML escapes user content and offers only existing audited detail link',()=>{
 const html=renderSprintBoard([item('safe','2026-11-18',{title:'<img src=x onerror=alert(1)>',area:'<script>bad()</script>'})],base);
 assert.ok(html.includes('&lt;img'));assert.ok(html.includes('&lt;script'));
 assert.ok(!html.includes('<img'));assert.ok(!html.includes('<script'));
 assert.ok(html.includes('data-ticket="safe"'));
 assert.ok(html.includes('data-sprint-shift="1"'));
 assert.ok(!html.includes('data-action="new"'));
 assert.ok(html.includes('José debe aprobar el catálogo'));
});
test('single QA route integrates sprint into Mis tareas without touching corporate calendar',()=>{
 const app=readFileSync(new URL('../src/js/app.js',import.meta.url),'utf8');
 assert.ok(app.includes("import {renderSprintBoard} from './ui-sprint-board.js'"));
 assert.ok(app.includes("operationalAgenda(false) + sprintBoard()"));
 assert.ok(app.includes("mountVerifiedAgenda"));
 assert.ok(app.includes("state.sprintOffset+=shift"));
});
