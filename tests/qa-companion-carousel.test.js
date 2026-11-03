import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const page=readFileSync(new URL('../qa/simulacion-operativa.html',import.meta.url),'utf8');

test('carousel exposes accessible navigation and selectable synthetic roles',()=>{
 for(const item of ['id="comp-prev"','id="comp-next"','id="companion-track"','aria-pressed="false"','data-person="Gerencia"','data-person="Seguridad"','Delegado ficticio QA'])assert.ok(page.includes(item),item);
});
test('no real employee or delegate portraits are shipped with public carousel',()=>{
 assert.match(page,/No muestran fotografías ni identidades reales/);
 assert.doesNotMatch(page,/(fotosColaboradores|Fotos Delegados|media\/fotosColaboradores)/);
});
test('none option clears selections and screen-reader state',()=>{
 assert.match(page,/state\.companions=\[\]/);
 assert.match(page,/setAttribute\('aria-pressed','false'\)/);
 assert.match(page,/companion-selected/);
});
test('carousel remains demonstrative and does not claim real availability',()=>{
 assert.match(page,/SIMULACIÓN QA/);
 assert.match(page,/no representan disponibilidad real/i);
});
