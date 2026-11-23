import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildOperationalAgenda,addOperationalDays,validOperationalDate} from '../src/js/services/operational-agenda.js';
import {renderOperationalAgenda} from '../src/js/ui-operational-agenda.js';

const item=(id,date,overrides={})=>({
 id,title:'Caso '+id,project_id:'p1',assignee:'user-a',due_date:date,
 status:'Pendiente',priority:'Media',area:'Común',...overrides
});
const config={projectId:'p1',userId:'user-a',asOf:'2026-11-19'};

test('windows are mutually exclusive and the Colombia-local date boundary is stable',()=>{
 assert.equal(validOperationalDate('2026-02-30'),false);
 assert.equal(addOperationalDays('2026-12-31',1),'2027-01-01');
 const rows=[
  item('late','2026-11-18'),item('today','2026-11-19'),
  item('week','2026-11-20'),item('week7','2026-11-26'),
  item('fortnight','2026-11-27'),item('day15','2026-12-04'),
  item('later','2026-12-05'),item('closed','2026-11-17',{status:'Cerrada'})
 ];
 const data=buildOperationalAgenda(rows,config);
 assert.deepEqual(data.groups.map(g=>[g.key,g.items.length]),[
  ['overdue',1],['today',1],['week',2],['fortnight',2],['later',1]
 ]);
 assert.equal(data.total,7);
 assert.equal(data.source,'persisted-tickets');
});

test('only the assigned actor in the selected property is visible; invalid data is not shown as clear',()=>{
 const rows=[item('mine','2026-11-19'),
  item('other-project','2026-11-19',{project_id:'p2'}),
  item('other-user','2026-11-19',{assignee:'user-b'}),
  item('invalid','2026-02-30'),
  item('unknown','2026-11-19',{status:'Estado falso'})];
 const data=buildOperationalAgenda(rows,config);
 assert.equal(data.total,1);
 assert.equal(data.unclassified,2);
 assert.equal(data.groups[1].items[0].id,'mine');
 const html=renderOperationalAgenda(rows,config);
 assert.ok(html.includes('registros no verificables se omitieron'));
 for(const word of ['other-project','other-user','invalid','unknown'])assert.ok(!html.includes(word));
});

test('HTML-escapes user-facing fields, uses existing ticket action, never exposes controls to write',()=>{
 const html=renderOperationalAgenda([item('safe','2026-11-19',{
 title:'<img src=x onerror=alert(1)>',area:'<script>alert(2)</script>'
 })],config);
 assert.ok(html.includes('&lt;img'));
 assert.ok(html.includes('&lt;script'));
 assert.ok(!html.includes('<img'));
 assert.ok(!html.includes('<script'));
 assert.ok(html.includes('data-ticket="safe"'));
 assert.ok(html.includes('no incluye aún actividades recurrentes'));
 assert.ok(!html.includes('data-action="new"'));
});

test('empty state does not masquerade as a complete operational agenda',()=>{
 assert.equal(buildOperationalAgenda([],config).total,0);
 const html=renderOperationalAgenda([],config);
 assert.ok(html.includes('Sin pendientes registrados'));
 assert.ok(html.includes('Fuente: bitácora persistente'));
 assert.ok(!html.includes('Todo al día'));
 assert.throws(()=>buildOperationalAgenda(null,config));
 assert.throws(()=>buildOperationalAgenda([],{...config,userId:''}));
});

test('QA Integral hooks the view into Home and Mis tareas; corporate agenda remains untouched',()=>{
 const app=readFileSync(new URL('../src/js/app.js',import.meta.url),'utf8');
 assert.ok(app.includes("from './ui-operational-agenda.js'"));
 assert.ok(app.includes("operationalAgenda(true)"));
 assert.ok(app.includes("state.page === 'mine' ? operationalAgenda(false)"));
 assert.ok(app.includes("state.page === 'agenda'"));
 assert.ok(app.includes("mountVerifiedAgenda"));
});

test('team agenda shows priority and resolves the assignee only within the selected property',()=>{
 const rows=[item('urgent','2026-11-19',{priority:'Urgente'})];
 const html=renderOperationalAgenda(rows,{...config,scope:'team',role:'coordinator',members:[
  {project_id:'p2',user_id:'user-a',name:'Otro conjunto'},
  {project_id:'p1',user_id:'user-a',name:'Delegada <QA>'}
 ]});
 assert.match(html,/Prioridad: Urgente/);
 assert.match(html,/Responsable: Delegada &lt;QA&gt;/);
 assert.ok(!html.includes('Otro conjunto'));
});

test('full agenda opens tasks after day 15 within the selected scope',()=>{
 const rows=[
  item('own-later','2026-12-05'),
  item('team-later','2026-12-06',{assignee:'user-b'}),
  item('foreign-later','2026-12-07',{project_id:'p2'})
 ];
 const team={...config,scope:'team',role:'coordinator'};
 const html=renderOperationalAgenda(rows,team);
 assert.match(html,/data-operational-group="later"/);
 assert.match(html,/data-ticket="own-later"/);
 assert.match(html,/data-ticket="team-later"/);
 assert.doesNotMatch(html,/foreign-later/);
 assert.doesNotMatch(renderOperationalAgenda(rows,config),/team-later/);
 const home=renderOperationalAgenda(rows,{...team,compact:true});
 assert.doesNotMatch(home,/data-operational-group="later"|data-ticket="own-later"|team-later/);
 assert.match(home,/1 tareas posteriores a 15 días/);
});
