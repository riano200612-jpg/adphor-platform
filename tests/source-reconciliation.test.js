import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceSchemaVersions} from '../qa/contracts/source-schema-versions.js';
import {sourceFieldMappings} from '../qa/contracts/source-field-mappings.js';
import {reconcileSourceBatch} from '../qa/contracts/source-reconciliation.js';

function row(version,id='SYNTHETIC-1') {
 const header=sourceSchemaVersions[version],values=Array(header.length).fill('');
 values[header.indexOf(sourceFieldMappings[version].sourceId)]=id;
 if(version==='portal.pqrs.2026-11-05'){
  for (const [key,value] of Object.entries({
   ID_Copropiedad:'project-synthetic',Tipo:'Petición',Prioridad_Original:'Media',
   Estado_Actual:'Recibida',Prioridad_Actual:'Alta'
  }))values[header.indexOf(key)]=value;
 }
 return values;
}
test('every historical schema supports non-mutating synthetic reconciliation',()=>{
 for(const [version,header] of Object.entries(sourceSchemaVersions)){
  const original=row(version),snapshot=JSON.stringify(original);
  const report=reconcileSourceBatch({sourceVersion:version,header,rows:[original]});
  assert.equal(report.status,'RECONCILIATION_ONLY');
  assert.equal(report.eligibleForImport,false);
  assert.equal(report.validShape,1);
  assert.equal(JSON.stringify(original),snapshot);
 }
});
test('historical collisions are quarantined, not silently collapsed or uploaded',()=>{
 const version='portal.reuniones.2026-11-05',header=sourceSchemaVersions[version];
 const report=reconcileSourceBatch({sourceVersion:version,header,rows:[row(version,'same'),row(version,'same')]});
 assert.equal(report.duplicateSourceIds,1);
 assert.equal(report.requiresReview,1);
 assert.equal(report.inspected,2);
 assert.equal(JSON.stringify(report).includes('same'),false);
});
test('short, extra, non-scalar, nonfinite and missing-ID rows are rejected safely',()=>{
 const version='master.visitas.2026-11-05',header=sourceSchemaVersions[version];
 const incomplete=row(version).slice(0,-1);
 const extra=[...row(version),'extra'];
 const nonScalar=row(version);nonScalar[1]={private:'value'};
 const nonFinite=row(version);nonFinite[1]=Infinity;
 const missing=row(version,'');
 const report=reconcileSourceBatch({sourceVersion:version,header,
 rows:[incomplete,extra,nonScalar,nonFinite,missing]});
 assert.equal(report.malformedRows,4);
 assert.equal(report.missingSourceIds,1);
 assert.equal(report.requiresReview,5);
 assert.equal(report.validShape,0);
});
test('PQRS unknowns and Pendiente remain unresolved',()=>{
 const version='portal.pqrs.2026-11-05',header=sourceSchemaVersions[version];
 const pending=row(version);pending[header.indexOf('Prioridad_Actual')]='Pendiente';
 const legitUnknown=row(version,'SYNTHETIC-2');legitUnknown[header.indexOf('Tipo')]='Histórico no catalogado';
 const report=reconcileSourceBatch({sourceVersion:version,header,rows:[pending,legitUnknown]});
 assert.equal(report.pqrsSemanticReview,2);
 assert.equal(report.validShape,0);
 assert.equal(report.eligibleForImport,false);
});
test('unknown version, mismatched header, and malformed input fail closed',()=>{
 assert.deepEqual(reconcileSourceBatch({sourceVersion:'unknown',header:[],rows:[]}),
  {status:'BLOCKED',reason:'UNKNOWN_SOURCE_VERSION'});
 const version='master.pqrs.2026-11-05',header=sourceSchemaVersions[version];
 assert.equal(reconcileSourceBatch({sourceVersion:version,header:[...header,'new'],rows:[]}).status,'BLOCKED');
 assert.equal(reconcileSourceBatch({sourceVersion:version,header,rows:null}).reason,'ROWS_NOT_ARRAY');
});
