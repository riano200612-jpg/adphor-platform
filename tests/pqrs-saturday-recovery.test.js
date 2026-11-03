import test from 'node:test';
import assert from 'node:assert/strict';
import {sourcePortalUrl,pqrsPortalRoute} from '../src/js/ui-pqrs-unified.js';
import {staffNameKey,staffForProject,photoForStaff} from '../src/js/ui-client-source-review.js';

const deploy='https://script.google.com/macros/s/AKfycbxw64JyydOaye-GksILdtYO4KvshS3OrNW6lXAKmq_Q/exec';
test('PQRS propietarios, consulta y equipo usan únicamente rutas originales verificables',()=>{
 assert.equal(sourcePortalUrl({environment:deploy}),deploy);
 assert.equal(pqrsPortalRoute(deploy,'owners'),deploy+'?page=form');
 assert.equal(pqrsPortalRoute(deploy,'tracking'),deploy+'?page=status');
 assert.equal(pqrsPortalRoute(deploy,'staff'),deploy+'?page=portal-team');
 assert.throws(()=>pqrsPortalRoute(deploy,'admin'));
 assert.throws(()=>sourcePortalUrl({stored:'https://script.google.com.evil.org/exec'}));
 assert.equal(sourcePortalUrl({}), '');
});
test('carrusel empareja fotografías por nombre exacto, con acentos',()=>{
 const entries=[
  {name:'media/fotosColaboradores/24. Paola Herrera.jpg'},
  {name:'media/fotosColaboradores/11. María Jiménez.jpeg'}
 ];
 assert.equal(staffNameKey('María Jiménez'),staffNameKey('maria jimenez'));
 assert.equal(photoForStaff({Delegado:'Paola Herrera'},entries)?.name,entries[0].name);
 assert.equal(photoForStaff({Delegado:'Maria Jimenez'},entries)?.name,entries[1].name);
 assert.equal(photoForStaff({Delegado:'Otra Persona'},entries),null);
});
test('personal restringido a ID de delegado y coordinador asignados',()=>{
 const p={ID_Delegado:5,ID_Coordinador:'12'};
 const people=[{ID_Delegado:5,Delegado:'Uno'},{ID_Delegado:12,Delegado:'Dos'},{ID_Delegado:88,Delegado:'Externo'}];
 assert.deepEqual(staffForProject(p,people).map(x=>x.Delegado),['Uno','Dos']);
 assert.deepEqual(staffForProject({ID_Delegado:0,ID_Coordinador:''},people),[]);
});
