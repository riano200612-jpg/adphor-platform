import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, allowedActions, filterTickets, metrics, today, validateInput, validateFiles } from '../src/js/core/workflow.js';
const members = [{ user_id:'tech',role:'technician' },{ user_id:'boss',role:'coordinator' }];
const tech = { id:'tech',role:'technician',name:'Técnico' };
const boss = { id:'boss',role:'coordinator',name:'Coordinador' };
const base = () => ({ id:'case-1',title:'Revisión piscina',description:'Fuga detectada',area:'Piscina',location:'Cuarto de máquinas',priority:'Alta',assignee:'tech',due_date:today(),status:'Pendiente',version:1,history:[] });
test('full workflow requires photographic intervention and coordinator verification', () => {
  let row = applyAction(base(),'start',{},tech,members);
  assert.throws(() => applyAction(row,'submit',{note:'Listo'},tech,members),/fotografía/);
  row = applyAction(row,'submit',{note:'Tubería reparada',evidence:[{path:'photo'}]},tech,members);
  assert.equal(row.status,'Por verificar');
  assert.throws(() => applyAction(row,'close',{note:'Verificado'},tech,members),/permiso/);
  row = applyAction(row,'close',{note:'Prueba de funcionamiento satisfactoria'},boss,members);
  assert.equal(row.status,'Cerrada'); assert.equal(row.history.length,3); assert.equal(row.version,4);
  row = applyAction(row,'reopen',{note:'La fuga volvió a presentarse'},boss,members);
  assert.equal(row.status,'En proceso'); assert.equal(row.history.length,4);
});
test('viewer and unassigned technician cannot advance a case', () => {
  assert.deepEqual(allowedActions(base(),'viewer','boss'),[]);
  assert.ok(!allowedActions(base(),'technician','other').includes('start'));
  assert.throws(() => applyAction(base(),'close',{note:'Listo'},boss,members));
});
test('assignment validates project membership and deadlines', () => {
  assert.throws(() => applyAction(base(),'assign',{assignee:'stranger',due_date:today()},boss,members));
  assert.throws(() => applyAction(base(),'assign',{assignee:'boss',due_date:'2020-01-01'},boss,members));
  const row = applyAction(base(),'assign',{assignee:'boss',due_date:today()},boss,members);
  assert.equal(row.assignee,'boss'); assert.equal(row.history[0].actor,'Coordinador');
});
test('filters normalize accents, scope mine and count actual records', () => {
  const a = base(), b = {...base(),id:'case-2',status:'Cerrada',assignee:'boss'};
  assert.equal(filterTickets([a,b],{search:'revision',mine:true},'tech').length,1);
  assert.equal(metrics([a,b]).rate,50); assert.equal(metrics([]).closed,0);
  assert.equal(metrics([{...b,due_date:'2020-01-01'}]).overdue,0);
});
test('creation rejects empty text, invalid areas and outsiders', () => {
  validateInput(base(),{areas:['Piscina']},members);
  assert.throws(() => validateInput({...base(),title:' '},{areas:['Piscina']},members));
  assert.throws(() => validateInput(base(),{areas:['Jardín']},members));
  assert.throws(() => validateInput({...base(),assignee:'outside'},{areas:['Piscina']},members));
});
test('uploads limit count, size and media types', () => {
  validateFiles([{type:'image/png',size:100}]);
  assert.throws(() => validateFiles([{type:'image/svg+xml',size:100}]));
  assert.throws(() => validateFiles([{type:'image/png',size:3*1024*1024}]));
  assert.throws(() => validateFiles(Array(4).fill({type:'image/png',size:100})));
});
