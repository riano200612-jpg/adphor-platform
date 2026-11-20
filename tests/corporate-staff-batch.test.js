import test from 'node:test';
import assert from 'node:assert/strict';
import {planCorporatePhotoBatch} from '../src/js/ui-corporate-staff.js';

const person=(id,name,photo_path=null)=>({id:'delegate-'+id,name,photo_path});
const jpg=(name,size=900)=>({name,type:'image/jpeg',size});
test('select seven verified staff portraits with numbered QA identities, no image changes',()=>{
 const people=[
  person(16,'Ruby Luz Ramos'),person(37,'Jeaneth Rey'),
  person(47,'José Miguel Herrera'),person(48,'Jorge Andrés Castilla Belandria'),
  person(51,'Lizbeth Mary Morales Torrente'),person(52,'Yestin Paola Zamora Aguilar'),
  person(53,'Sonia Arroyo')
 ];
 const files=[
 jpg('16. Ruby Ramos.jpg'),jpg('37. Yeaneth Rey.jpg'),jpg('47. José Herrera.jpg'),
 jpg('48. Jorge Andrés Castilla Belandria.jpg'),jpg('51. Lizbet Morales.jpg'),
 jpg('52. Yestin Zamora.jpg'),jpg('53. Sonia Arroyo.jpg')
 ];
 const plan=planCorporatePhotoBatch(people,files);
 assert.equal(plan.selected.length,7);
 assert.equal(plan.rejected.length,0);
 assert.deepEqual(plan.selected.map(x=>x.person.id),[16,37,47,48,51,52,53].map(x=>'delegate-'+x));
});
test('reject duplicated, already photographed, unsupported and mismatched identities',()=>{
 const people=[person(16,'Ruby Luz Ramos'),person(11,'José Guzmán Castilla','delegate-11/saved.png'),person(54,'aa')];
 const p=planCorporatePhotoBatch(people,[
  jpg('16. Ruby Ramos.jpg'),jpg('16. Ruby Ramos.jpg'),
  jpg('11. José Guzmán Castilla.jpg'),jpg('54. James Alexander Riaño.jpg'),
  jpg('16. Otra Persona.jpg'),jpg('../bad-file.jpg'),
  {name:'16. Ruby Ramos.png',type:'image/jpeg',size:120},
  jpg('16. Ruby Ramos.jpg',11000000)
 ]);
 assert.equal(p.selected.length,1);
 assert.equal(p.rejected.length,7);
 assert.ok(p.rejected.some(x=>x.reason.includes('ya tiene una fotografía')));
 assert.ok(p.rejected.some(x=>x.reason.includes('no identificado')));
 assert.ok(p.rejected.some(x=>x.reason.includes('otro archivo')));
});
test('fail closed on overly large batches',()=>{
 const p=planCorporatePhotoBatch([person(16,'Ruby Luz Ramos')],Array(21).fill(jpg('16. Ruby Ramos.jpg')));
 assert.equal(p.selected.length,0);
 assert.match(p.rejected[0].reason,/20 imágenes/);
});
