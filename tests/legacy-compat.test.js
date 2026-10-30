import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveLegacyRoute, normalizePriority, requireProjectAccess } from '../src/js/services/legacy-compat.js';
test('conserva rutas legadas del portal',()=>{
  assert.equal(resolveLegacyRoute('form'),'/pqrs/radicar');
  assert.equal(resolveLegacyRoute('gestion-correos'),'/pqrs/correos');
  assert.equal(resolveLegacyRoute('status'),'/pqrs/calificar');
  assert.equal(resolveLegacyRoute('__proto__'),null);
});
test('normaliza prioridad de administradoras',()=>{
  assert.equal(normalizePriority('Alta'),'alto');
  assert.equal(normalizePriority('MEDIA'),'medio');
  assert.throws(()=>normalizePriority('urgente'));
});
test('no autoriza otra copropiedad',()=>{
  assert.equal(requireProjectAccess({projectId:'porto',memberProjectIds:['porto']}),'porto');
  assert.throws(()=>requireProjectAccess({projectId:'otro',memberProjectIds:['porto']}));
});
