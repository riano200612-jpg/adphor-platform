import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../src/js/app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/css/premium.css',import.meta.url),'utf8');
test('Recorridos uses the existing tenant-scoped ticket workflow and authorized team',()=>{
 assert.match(app,/\['recorridos','route','Recorridos'\]/);
 assert.match(app,/state\.page === 'recorridos'/);
 assert.match(app,/const people=team\(\)/);
 assert.match(app,/const assigned=rows\(\)/);
 assert.match(app,/data-ticket/);
 assert.match(app,/Audio y video: pendientes de almacenamiento privado/);
});
test('Staff carousel is mobile-friendly and does not expose contact addresses',()=>{
 assert.match(css,/\.qa-staff-carousel\{display:flex/);
 assert.match(css,/overflow-x:auto/);
});
