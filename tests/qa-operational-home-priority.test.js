import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../src/js/app.js',import.meta.url),'utf8');

test('dashboard prioritizes read-only operational commitments before other module cards',()=>{
 const start=app.indexOf('function dashboard()');
 const end=app.indexOf('function ticketsPage()',start);
 assert.ok(start>=0&&end>start);
 const dashboard=app.slice(start,end);
 assert.ok(dashboard.includes(' + stats(list) + operationalAgenda(true) + '));
 assert.ok(dashboard.indexOf('operationalAgenda(true)')<dashboard.indexOf('<div class="module-grid">'));
 assert.ok(dashboard.includes('data-page="mine"')===false || dashboard.includes('operationalAgenda(true)'));
});

test('dashboard copy does not deny certified internal PQRS or falsely announce all tasks complete',()=>{
 assert.ok(app.includes('Radica y consulta solicitudes con seguimiento'));
 assert.ok(!app.includes('Consulta de procedencia histórica; radicación real pendiente'));
 assert.ok(app.includes('<h3>Sin alertas urgentes</h3>'));
 assert.ok(!app.includes('<h3>Todo al día</h3>'));
 assert.ok(app.includes('Otras tareas pueden seguir pendientes.'));
});
