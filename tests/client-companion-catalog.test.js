import test from 'node:test';
import assert from 'node:assert/strict';
import {zoneRoleForSector,companionCandidates} from '../src/js/services/client-companion-catalog.js';

test('sector selects the original client zone roles',()=>{
 assert.equal(zoneRoleForSector('Bocagrande'),'CZB');
 assert.equal(zoneRoleForSector('Castillogrande'),'CZB');
 assert.equal(zoneRoleForSector('Manga'),'CZM');
 assert.equal(zoneRoleForSector('La Popa'),'CZM');
 assert.equal(zoneRoleForSector('Zona Norte'),'CZN');
 assert.equal(zoneRoleForSector('Centro'),null);
});
test('companion list preserves zone first and management hierarchy',()=>{
 const staff=[
  {id:'a',nombre:'Administración',rol:'A'},
  {id:'z',nombre:'Zona',rol:'CZB',leyendaRol:'Coordinación de zona'},
  {id:'g',nombre:'Gerencia',rol:'GG'},
  {id:'n',nombre:'Otra zona',rol:'CZN'},
  {id:'x',nombre:'No autorizado',rol:'UNKNOWN'}
 ];
 const result=companionCandidates(staff,'Bocagrande');
 assert.deepEqual(result.map(x=>x.id),['z','g','a']);
 assert.equal(result[0].leyendaRol,'Coordinación de zona');
 assert.equal(result[0].photoStoragePath,null);
});
test('unknown zone excludes zone-only roles and duplicate identities',()=>{
 const result=companionCandidates([
  {id:'1',nombre:'Uno',rol:'GG'},
  {id:'1',nombre:'Duplicado',rol:'GF'},
  {id:'2',nombre:'Zona',rol:'CZB'}
 ],'Centro');
 assert.deepEqual(result.map(x=>x.id),['1']);
});
test('requires an already authorized staff array',()=>{
 assert.throws(()=>companionCandidates(null,'Manga'),TypeError);
});
