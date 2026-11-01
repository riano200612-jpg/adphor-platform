import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const ui=readFileSync(new URL('../src/js/ui-meeting-assessment.js',import.meta.url),'utf8');
const wizard=readFileSync(new URL('../src/js/ui-meeting-experience.js',import.meta.url),'utf8');
const app=readFileSync(new URL('../src/js/app.js',import.meta.url),'utf8');
const demo=readFileSync(new URL('../src/js/services/demo-calendar.js',import.meta.url),'utf8');
test('accompaniment lists only authorized team for selected property',()=>{
 assert.match(ui,/members\.filter\(m=>m\.project_id===projectId/);
 assert.match(ui,/Sin acompañamiento requerido/);
 assert.match(app,/projectId:state\.projectId,members:team\(\)/);
 assert.match(wizard,/querySelector\('\.meeting-escorts'\)/);
});
test('realistic fixtures are opt-in and explicitly synthetic',()=>{
 assert.match(ui,/data-demo-scenarios/);
 assert.match(ui,/if\(demo\)/);
 assert.match(demo,/seedDemoMeetingScenarios/);
 assert.match(demo,/DATOS FICTICIOS/);
 assert.match(demo,/qa-adphor-consejo/);
});
test('agenda simulation does not pretend to write Google Calendar or SQL',()=>{
 assert.match(ui,/SIMULACIÓN LOCAL/);
 assert.match(ui,/backend transaccional/);
 assert.match(demo,/localStorage/);
});
