import test from 'node:test';
import assert from 'node:assert/strict';
import {portalSourceColumns} from '../qa/contracts/portal-source-columns.js';
import {inspectPortalPqrsRow,summarizePortalPqrsRows} from '../qa/contracts/portal-pqrs-quality-gate.js';

const columns=portalSourceColumns.PQRS_Master;
const syntheticRow=(patch={})=>{
  const row=Array(columns.length).fill('');
  const fields={ID_PQRS:'QA-SYNTHETIC-001',ID_Copropiedad:'qa-example',Tipo:'Petición',
    Prioridad_Original:'Media',Estado_Actual:'Recibida',Prioridad_Actual:'Media',...patch};
  for(const [name,value] of Object.entries(fields))row[columns.indexOf(name)]=value;
  return row;
};
test('valid synthetic PQRS may be mapped without changing its original row',()=>{
  const row=syntheticRow();const before=JSON.stringify(row);
  assert.equal(inspectPortalPqrsRow(row).eligibleForAutomaticMapping,true);
  assert.equal(JSON.stringify(row),before);
});
test('historical shifted source values require manual review, without showing private data',()=>{
  const row=syntheticRow({Tipo:'Unrecognized historic value',Prioridad_Original:'Servicios en Línea, Informática y Tecnología',
     Estado_Actual:'Aseo & Limpieza',Prioridad_Actual:'Pendiente'});
  const out=inspectPortalPqrsRow(row);
  assert.equal(out.eligibleForAutomaticMapping,false);
  assert.deepEqual(out.issues,[
    'UNKNOWN_TYPE_OR_SHIFT','UNKNOWN_ORIGINAL_PRIORITY_OR_SHIFT',
    'UNKNOWN_STATUS_OR_SHIFT','UNRESOLVED_CURRENT_PRIORITY'
  ]);
  assert.equal(JSON.stringify(out).includes('Servicios en Línea'),false);
});
test('missing source identifiers cannot pass mapping gate',()=>{
  const out=inspectPortalPqrsRow(syntheticRow({ID_PQRS:'',ID_Copropiedad:''}));
  assert.deepEqual(out.issues,['MISSING_SOURCE_ID','MISSING_PROJECT_ID']);
});
test('aggregate report contains counts and reason codes only',()=>{
  const report=summarizePortalPqrsRows([syntheticRow(),syntheticRow({Prioridad_Actual:'Pendiente'})]);
  assert.equal(report.inspected,2);
  assert.equal(report.requiresReview,1);
  assert.equal(report.issueCounts.UNRESOLVED_CURRENT_PRIORITY,1);
});
