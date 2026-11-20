import test from 'node:test';
import assert from 'node:assert/strict';
import {buildOperationalAgenda} from '../src/js/services/operational-agenda.js';
import {renderOperationalAgenda} from '../src/js/ui-operational-agenda.js';

const config={projectId:'property-1',userId:'actor-1',asOf:'2026-11-20'};
const ticket=(id,overrides={})=>({
  id,title:'Compromiso '+id,project_id:'property-1',assignee:'actor-1',
  due_date:'2026-11-20',status:'Pendiente',area:'Zona común',priority:'Media',...overrides
});

test('only manager/coordinator may project the team, limited to the selected property',()=>{
  const tickets=[
    ticket('mine'),
    ticket('colleague',{assignee:'actor-2'}),
    ticket('unassigned',{assignee:null}),
    ticket('other-tenant',{project_id:'property-2',assignee:'actor-2'}),
    ticket('closed',{status:'Cerrada',assignee:'actor-2'})
  ];
  const personal=buildOperationalAgenda(tickets,config);
  assert.deepEqual(personal.groups[1].items.map(t=>t.id),['mine']);
  for(const role of ['viewer','technician','',null]){
    assert.throws(()=>buildOperationalAgenda(tickets,{...config,role,scope:'team'}),/rol autorizado/);
  }
  for(const scope of ['all','admin','',null]){
    assert.throws(()=>buildOperationalAgenda(tickets,{...config,role:'admin',scope}),/rol autorizado/);
  }
  for(const role of ['admin','coordinator']){
    const result=buildOperationalAgenda(tickets,{...config,role,scope:'team'});
    assert.equal(result.scope,'team');
    assert.deepEqual(result.groups[1].items.map(t=>t.id),['colleague','mine','unassigned']);
    assert.equal(result.total,3);
    assert.equal(result.groups[1].items.find(t=>t.id==='unassigned').assignee,'');
  }
});

test('manager UI displays an explicit read-only scope switch; personal home remains self-scoped',()=>{
  const tickets=[ticket('mine'),ticket('colleague',{assignee:'actor-2'})];
  const team=renderOperationalAgenda(tickets,{...config,role:'coordinator',scope:'team'});
  assert.ok(team.includes('Agenda operativa del equipo'));
  assert.ok(team.includes('Compromisos del equipo por plazo'));
  assert.ok(team.includes('data-sprint-scope="team" aria-pressed="true"'));
  assert.ok(team.includes('colleague'));
  assert.ok(!team.includes('data-action="new"'));
  assert.ok(!team.includes('data-action="close"'));

  const compact=renderOperationalAgenda(tickets,{...config,role:'admin',scope:'team',compact:true});
  assert.ok(compact.includes('Agenda operativa de mis tareas'));
  assert.ok(!compact.includes('data-sprint-scope='));
  assert.ok(!compact.includes('colleague'));

  const viewer=renderOperationalAgenda(tickets,{...config,role:'viewer'});
  assert.ok(!viewer.includes('data-sprint-scope='));
  assert.ok(!viewer.includes('colleague'));
});

test('cross-tenant titles and malicious input never render into managers team cards',()=>{
  const html=renderOperationalAgenda([
    ticket('safe',{title:'<script>bad</script>',area:'<img src=x>',assignee:null}),
    ticket('other',{project_id:'property-2',title:'OTHER_TENANT_SECRET'})
  ],{...config,role:'admin',scope:'team'});
  assert.ok(html.includes('&lt;script&gt;bad&lt;/script&gt;'));
  assert.ok(html.includes('&lt;img src=x&gt;'));
  assert.ok(html.includes('Sin responsable asignado'));
  assert.ok(!html.includes('OTHER_TENANT_SECRET'));
  assert.ok(!html.includes('<script>'));
  assert.ok(!html.includes('<img'));
});
