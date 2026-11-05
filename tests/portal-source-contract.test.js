import test from 'node:test';
import assert from 'node:assert/strict';
import { portalSourceColumns, validatePortalHeader } from '../qa/contracts/portal-source-columns.js';

test('Portal contracts preserve 32 Visitas and 47 PQRS original fields', () => {
  assert.equal(portalSourceColumns.Visitas.length, 32);
  assert.equal(portalSourceColumns.PQRS_Master.length, 47);
  assert.equal(new Set(portalSourceColumns.Visitas).size, 32);
  assert.equal(new Set(portalSourceColumns.PQRS_Master).size, 47);
  assert.equal(validatePortalHeader('Visitas', [...portalSourceColumns.Visitas]), true);
  assert.equal(validatePortalHeader('PQRS_Master', [...portalSourceColumns.PQRS_Master]), true);
});

test('Portal schema gate rejects reordered, truncated and extra columns', () => {
  const reordered = [...portalSourceColumns.Visitas];
  [reordered[2], reordered[3]] = [reordered[3], reordered[2]];
  assert.throws(() => validatePortalHeader('Visitas', reordered), /schema mismatch/);
  assert.throws(() => validatePortalHeader('Visitas', reordered.slice(0, -1)), /column count mismatch/);
  assert.throws(() => validatePortalHeader('Visitas', [...portalSourceColumns.Visitas, 'Unapproved field']), /column count mismatch/);
});

test('Portal PQRS historical punctuation cannot be normalized silently', () => {
  const renamed = [...portalSourceColumns.PQRS_Master];
  const index = renamed.indexOf('Just_Cambio_Prioridad,');
  assert.ok(index >= 0);
  renamed[index] = 'Just_Cambio_Prioridad';
  assert.throws(() => validatePortalHeader('PQRS_Master', renamed), /schema mismatch/);
});

test('Portal gate rejects unrecognized sheets and malformed headers', () => {
  assert.throws(() => validatePortalHeader('Unknown', []), /Unknown Portal source sheet/);
  assert.throws(() => validatePortalHeader('Visitas', null), /string array/);
  assert.throws(() => validatePortalHeader('Visitas', Array(32).fill(null)), /string array/);
});
