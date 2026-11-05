import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceSchemaVersions} from '../qa/contracts/source-schema-versions.js';
import {sourceFieldMappings,inspectVersionedFieldMapping} from '../qa/contracts/source-field-mappings.js';
test('all six sources have explicit reviewed candidates, never promotion authority',()=>{
 assert.equal(Object.keys(sourceFieldMappings).length,6);
 for(const [version,headers] of Object.entries(sourceSchemaVersions)){
  const result=inspectVersionedFieldMapping(version,headers);
  assert.equal(result.status,'MAPPING_CANDIDATE_ONLY');
  assert.equal(result.requiresTenantResolution,true);
  assert.equal(result.requiresFieldSemanticsReview,true);
  assert.equal(result.requiresSourceApproval,true);
 }
});
test('master PQRS has no project identifier: no invented property assignment',()=>{
 const version='master.pqrs.2026-11-05';
 assert.equal('projectCandidate' in sourceFieldMappings[version],false);
 assert.equal(inspectVersionedFieldMapping(version,sourceSchemaVersions[version]).projectIdentityMissingInSource,true);
});
test('two meetings versions preserve distinct historical record IDs',()=>{
 assert.equal(sourceFieldMappings['portal.reuniones.2026-11-05'].sourceId,'ID_Reunion');
 assert.equal(sourceFieldMappings['master.registros.2026-11-05'].sourceId,'ID_Registro');
});
test('mismatched source header cannot be mapped based on position',()=>{
 const v='portal.visitas.2026-11-05';const altered=[...sourceSchemaVersions[v]];
 altered[0]='ID_Registro';
 assert.equal(inspectVersionedFieldMapping(v,altered).status,'REVIEW');
 assert.equal(inspectVersionedFieldMapping('invented.version',altered).reason,'UNKNOWN_SOURCE_VERSION');
});
