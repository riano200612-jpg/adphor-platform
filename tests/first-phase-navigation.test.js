import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../src/js/app.js',import.meta.url),'utf8');
test('first phase and original portal coexist in single route map',()=>{
 for(const key of ["['tickets','clipboard-list','Mantenimientos']","['recorridos','route','Recorridos']","['agent-history'","data-page=\"tickets\"","data-page=\"mine\"","data-page=\"agent-history\"","data-page=\"reports\""])assert.ok(app.includes(key),key);
});
test('existing maintenance workflow remains available',()=>{
 for(const key of ['function ticketsPage()','function openCase(id)','function actionFields(action, t)','function newButton()'])assert.ok(app.includes(key),key);
});
