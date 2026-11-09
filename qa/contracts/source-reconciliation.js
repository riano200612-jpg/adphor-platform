// QA-only reconciliation gate for historical rows. No original data are emitted,
// written, normalized, assigned to tenants, or promoted to operational SQL.
import {sourceSchemaVersions,validateSourceSchema} from './source-schema-versions.js';
import {sourceFieldMappings} from './source-field-mappings.js';
import {inspectPortalPqrsRow} from './portal-pqrs-quality-gate.js';

const allowedKinds=new Set(['string','number','boolean']);
const safeCell=value=>value==null || (allowedKinds.has(typeof value)
  && (typeof value!=='number' || Number.isFinite(value)));
const sourceId=row=>String(row ?? '').trim();

export function reconcileSourceBatch({sourceVersion,header,rows}={}) {
  const schema=validateSourceSchema(sourceVersion,header);
  if (!schema.ok) return Object.freeze({status:'BLOCKED',reason:schema.code});
  if (!Array.isArray(rows)) return Object.freeze({status:'BLOCKED',reason:'ROWS_NOT_ARRAY'});
  const mapping=sourceFieldMappings[sourceVersion];
  if(!mapping || !header.includes(mapping.sourceId))
    return Object.freeze({status:'BLOCKED',reason:'NO_SOURCE_ID_MAPPING'});
  const idPosition=header.indexOf(mapping.sourceId);
  const encountered=new Set();
  const counts={validShape:0,requiresReview:0,duplicateSourceIds:0,missingSourceIds:0,
    malformedRows:0,pqrsSemanticReview:0};
  for(const row of rows) {
    if(!Array.isArray(row) || row.length!==header.length || row.some(v=>!safeCell(v))){
      counts.malformedRows++;counts.requiresReview++;continue;
    }
    const id=sourceId(row[idPosition]);
    if(!id){counts.missingSourceIds++;counts.requiresReview++;continue;}
    // An ID is unique only *within this explicit source version/batch*. Historical
    // collisions across revisions or different sources need separate reconciliation.
    if(encountered.has(id)){counts.duplicateSourceIds++;counts.requiresReview++;continue;}
    encountered.add(id);
    if(sourceVersion==='portal.pqrs.2026-11-05' &&
      !inspectPortalPqrsRow(row,{sourceVersion,header}).eligibleForAutomaticMapping){
      counts.pqrsSemanticReview++;counts.requiresReview++;continue;
    }
    counts.validShape++;
  }
  return Object.freeze({status:'RECONCILIATION_ONLY',sourceVersion,
    inspected:rows.length,...counts,eligibleForImport:false,
    requiresTenantApproval:true,requiresHistoricalConflictReview:true});
}
