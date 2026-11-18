import test from 'node:test';
import assert from 'node:assert/strict';
import {boardGovernancePlan,boardGovernanceView,boardGovernanceCsvRows}
 from '../src/js/services/miss-board-governance.js';
import {monthlyReportView,monthlyCsvRows}
 from '../src/js/ui-reports.js';

const report=()=>({
 project_name:'Conjunto sintético <b>Privado</b>',
 month:'2026-10-01',cutoff:'2026-11-01T05:00:00Z',
 opening:5,created:20,reopened:1,closure_events:18,
 ending:8,overdue:3,unknown_deadlines:2,seeded:0,
 closed_cases:15,
 areas:[{area:'Bombas',pending:8,created:20,review:2}],
 priorities:[{priority:'Alta',pending:8}],
 trend:[{month:'2026-09',created:10,closures:12},
        {month:'2026-10',created:20,closures:18}]
});

test('board annex yields substantive risk, decisions and provenance; no side effects',()=>{
 const r=report(),p=boardGovernancePlan(r);
 assert.equal(p.reconciled,true);
 assert.equal(p.partial,false);
 assert.ok(p.risks.some(x=>x.id==='GOV-02'));
 assert.ok(p.risks.some(x=>x.id==='GOV-03'));
 assert.ok(p.risks.some(x=>x.id==='GOV-04'));
 assert.equal(p.decisions.length,3);
 assert.equal(p.boardApproved,false);
 assert.equal(p.modelTrained,false);
 assert.equal(p.notificationsSent,false);
 const html=boardGovernanceView(r);
 assert.match(html,/Anexo de gobierno y decisiones/);
 assert.match(html,/30 días/);
 assert.match(html,/Huella certificada/);
 assert.match(html,/Aprobación de junta/);
 assert.doesNotMatch(html,/\baprobado por la junta\b/i);
 assert.ok(monthlyReportView(r).includes(html));
 assert.deepEqual(monthlyCsvRows(r).slice(-4),boardGovernanceCsvRows(r).slice(-4));
});
test('do not present a partial month as a complete comparison',()=>{
 const r={...report(),cutoff:'2026-10-20T19:00:00Z'};
 const p=boardGovernancePlan(r);
 assert.equal(p.partial,true);
 assert.match(p.status,/PERÍODO PARCIAL/);
});
test('mismatched balance or historical seeds require reconciliation before certification',()=>{
 for(const r of [{...report(),ending:9},{...report(),seeded:2}]){
  const p=boardGovernancePlan(r);
  assert.equal(p.reconciled,false);
  assert.match(p.status,/NO CERTIFICABLE/);
  assert.ok(p.risks.some(x=>x.id==='GOV-01'));
 }
});
test('unverified claims and malicious property names stay escaped and visible as draft',()=>{
 const r={...report(),project_name:'<img src=x onerror=alert(1)>'};
 const html=boardGovernanceView(r);
 assert.doesNotMatch(html,/<img/);
 assert.match(html,/&lt;img/);
 assert.match(html,/No se incluyeron PQRS/);
 assert.match(html,/no firma, aprueba/);
 assert.doesNotMatch(html,/costos reales|cumplimiento garantizado/i);
});
test('demonstration data are conspicuously noncertifiable',()=>{
 const r={...report(),is_demo:true};
 const p=boardGovernancePlan(r);
 assert.match(p.status,/DEMOSTRACIÓN - NO CERTIFICABLE/);
 assert.match(boardGovernanceView(r),/DEMOSTRACIÓN - NO CERTIFICABLE/);
});
test('missing unsafe counters, invalid project and wrong dates rejected',()=>{
 for(const bad of [
  {...report(),opening:-1},
  {...report(),overdue:Infinity},
  {...report(),project_name:''},
  {...report(),month:'2026-99-01'},
  {...report(),cutoff:'none'},
  {...report(),areas:[{area:'Bombas',pending:'8',review:2}]}
 ]){
  assert.throws(()=>boardGovernancePlan(bad),/insuficientes/);
 }
});
