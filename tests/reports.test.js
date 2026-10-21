import test from 'node:test';
import assert from 'node:assert/strict';
import {reportComparison,monthlyReportView,monthlyCsvRows} from '../src/js/ui-reports.js';
const report=()=>({project_name:'Propiedad <prueba>',month:'2026-10-01',cutoff:'2026-11-01T05:00:00Z',opening:5,created:20,closed_cases:15,closure_events:18,reopened:1,ending:8,overdue:3,unknown_deadlines:0,seeded:0,areas:[{area:'Bombas',created:20,pending:8,review:2}],priorities:[{priority:'Alta',pending:8}],trend:[{month:'2026-09',created:10,closures:12},{month:'2026-10',created:20,closures:18}]});
test('closed months compare the same measures, not unique cases vs closure events',()=>{
 const c=reportComparison(report()); assert.equal(c.partial,false); assert.equal(c.rows[0].percent,100); assert.equal(c.rows[1].percent,50); assert.equal(c.rows[1].current,18);
 assert.ok(monthlyReportView(report()).includes('+100%'));
});
test('Colombia month boundary prevents comparing a partial month as complete',()=>{
 const r={...report(),cutoff:'2026-11-01T04:59:59Z'};
 assert.equal(reportComparison(r).partial,true); assert.ok(monthlyReportView(r).includes('No comparable'));
 assert.equal(monthlyCsvRows(r).find(x=>x[0]==='Nuevos'&&x.length===5)[4],'No comparable');
});
test('zero baseline, missing reference and year change do not invent percentages',()=>{
 const r={...report(),month:'2026-01-01',cutoff:'2026-02-01T05:00:00Z',trend:[{month:'2025-12',created:0,closures:0}]};
 assert.equal(reportComparison(r).previousMonth,'2025-12'); assert.equal(reportComparison(r).rows[0].percent,null);
 const html=monthlyReportView(r); assert.ok(!/NaN|Infinity/.test(html)); assert.ok(html.includes('base anterior: 0')); assert.ok(html.includes('Propiedad &lt;prueba&gt;'));
 assert.equal(reportComparison({...r,trend:[]}).rows[0].prior,null);
});
