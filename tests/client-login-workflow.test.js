import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../src/js/app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/css/premium.css',import.meta.url),'utf8');
test('client login is labeled Portal Team without impersonating migrated photo',()=>{
 assert.match(app,/Portal Team/);
 assert.match(app,/Miss ADPHOR/);
 assert.match(app,/loginAvatarMarkup\(corporateAvatar\)/);
});
test('bitácora retains case creation and follows guided four-step workflow',()=>{
 for(const x of ['De la novedad a la solución','1. Registra','2. Asigna','3. Haz seguimiento','4. Verifica','function ticketsPage()','function openCase(id)'])assert.ok(app.includes(x),x);
 assert.match(css,/\.qa-guided-workflow ol/);
});
