import test from 'node:test';
import assert from 'node:assert/strict';
import {portalSourceColumns} from '../qa/contracts/portal-source-columns.js';
import {inspectPortalPqrsRow,summarizePortalPqrsRows} from '../qa/contracts/portal-pqrs-quality-gate.js';
import {sourceSchemaVersions,validateSourceSchema,mapSourceRow} from '../qa/contracts/source-schema-versions.js';

const columns=portalSourceColumns.PQRS_Master;
function syntheticRow(patch={}) {
 const row=Array(columns.length).fill('');
 const fields={ID_PQRS:'QA-FAKE',ID_Copropiedad:'qa-synthetic',Tipo:'Petición',
 Prioridad_Original:'Media',Estado_Actual:'Recibida',Prioridad_Actual:'Alta',...patch};
 for(const [k,v] of Object.entries(fields))row[columns.indexOf(k)]=v;
 return row;
}
test('short and long PQRS rows are quarantined before positional access',()=>{
 for(const row of [syntheticRow().slice(0,-1),[...syntheticRow(),'extra']]){
  const r=inspectPortalPqrsRow(row);
  assert.equal(r.eligibleForAutomaticMapping,false);
  assert.equal(r.classification,'ROW_SHAPE_MISMATCH');
  assert.deepEqual(r.issues,['ROW_LENGTH_MISMATCH']);
 }
});
test('unknown but possibly legitimate values are review, not declared corruption',()=>{
 const original=syntheticRow({Tipo:'Solicitud de servicio'}),snapshot=JSON.stringify(original);
 const r=inspectPortalPqrsRow(original);
 assert.equal(r.classification,'UNRECOGNIZED_OR_INCOMPLETE_REVIEW');
 assert.equal(r.eligibleForAutomaticMapping,false);
 assert.equal(JSON.stringify(original),snapshot);
 assert.equal(JSON.stringify(r).includes('Solicitud de servicio'),false);
});
test('multiple mismatches indicate possible column shift, without auto-repair',()=>{
 const r=inspectPortalPqrsRow(syntheticRow({Tipo:'Categoría externa',Prioridad_Original:'Tecnología'}));
 assert.equal(r.classification,'POSSIBLE_SHIFT_REVIEW');
 assert.equal(r.eligibleForAutomaticMapping,false);
});
test('Pendiente remains unresolved, never silently converted to Media',()=>{
 const row=syntheticRow({Prioridad_Actual:'Pendiente'});
 assert.deepEqual(inspectPortalPqrsRow(row).issues,['UNRESOLVED_CURRENT_PRIORITY']);
 assert.equal(row[columns.indexOf('Prioridad_Actual')],'Pendiente');
});
test('unknown or different historical version requires explicit adapter',()=>{
 assert.deepEqual(inspectPortalPqrsRow(syntheticRow(),{sourceVersion:'unknown'}).issues,['UNKNOWN_SOURCE_VERSION']);
 assert.deepEqual(inspectPortalPqrsRow(syntheticRow(),{sourceVersion:'master.pqrs.2026-11-05'}).issues,['HEADER_SHAPE_MISMATCH']);
});
test('six distinct source versions have exact 32/29/47/14/29/28-field schemas',()=>{
 const expected={'portal.visitas.2026-11-05':32,'master.visitas.2026-11-05':29,
 'portal.pqrs.2026-11-05':47,'master.pqrs.2026-11-05':14,
 'portal.reuniones.2026-11-05':29,'master.registros.2026-11-05':28};
 for(const [version,n] of Object.entries(expected)){
  const header=sourceSchemaVersions[version];
  assert.equal(header.length,n);
  assert.equal(validateSourceSchema(version,[...header]).ok,true);
  assert.equal(mapSourceRow(version,header,Array(n).fill('')).status,'VALIDATED_SOURCE_SHAPE');
  assert.equal(mapSourceRow(version,header,Array(n-1).fill('')).reason,'ROW_SHAPE_MISMATCH');
  const switched=[...header];[switched[0],switched[1]]=[switched[1],switched[0]];
  assert.equal(validateSourceSchema(version,switched).code,'HEADER_FIELD_MISMATCH');
 }
});
test('reports only aggregate counters, never source content',()=>{
 const report=summarizePortalPqrsRows([syntheticRow(),syntheticRow({Tipo:'legitimate-unrecognized'})]);
 assert.equal(report.inspected,2);assert.equal(report.requiresReview,1);
 assert.equal(JSON.stringify(report).includes('legitimate-unrecognized'),false);
});
