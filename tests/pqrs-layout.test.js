import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('../src/js/ui-pqrs.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/css/styles.css',import.meta.url),'utf8');
test('PQRS includes an explicit visible submit button, form and all client identity fields',()=>{
 for(const item of ['type="submit" class="pqrs-submit"','Enviar solicitud PQRS','name="tower"','name="apartment"','name="owner"','name="description"','data-new'])assert.ok(src.includes(item),item);
});
test('PQRS retains ADPHOR blue and gold with responsive form layout',()=>{
 assert.match(css,/#264b6b/i);assert.match(css,/#b59c21/i);
 assert.match(css,/\.pqrs-fields/);assert.match(css,/@media\(max-width:680px\)/);
});
