// QA-only: classification never changes original values or emits private contents.
// The default version preserves compatibility with existing QA callers; all import
// pipelines MUST pass an explicit version plus exact header and use source-schema-versions.
import {portalSourceColumns} from './portal-source-columns.js';
import {validateSourceSchema} from './source-schema-versions.js';

const CURRENT_VERSION='portal.pqrs.2026-11-05';
const types = new Set(['Petición', 'Queja', 'Reclamo', 'Sugerencia']);
const priorities = new Set(['Baja', 'Media', 'Alta', 'Crítica']);
const statuses = new Set(['Recibida', 'En Evaluación', 'Atendida (R)', 'Resuelta', 'Cerrada']);

export function inspectPortalPqrsRow(row, {sourceVersion=CURRENT_VERSION,header=portalSourceColumns.PQRS_Master}={}) {
  if (!Array.isArray(row)) throw new TypeError('PQRS row must be an array');
  const schema = validateSourceSchema(sourceVersion,header);
  if (!schema.ok || sourceVersion!==CURRENT_VERSION) {
    return Object.freeze({eligibleForAutomaticMapping:false,
      classification:'UNSUPPORTED_OR_UNVERIFIED_VERSION',
      issues:Object.freeze([schema.ok?'EXPLICIT_VERSION_ADAPTER_REQUIRED':schema.code])});
  }
  if(row.length!==header.length) {
    return Object.freeze({eligibleForAutomaticMapping:false,
      classification:'ROW_SHAPE_MISMATCH',issues:Object.freeze(['ROW_LENGTH_MISMATCH'])});
  }
  if(row.some(value=>value!==null && value!==undefined && !['string','number','boolean'].includes(typeof value))) {
    return Object.freeze({eligibleForAutomaticMapping:false,
      classification:'ROW_SHAPE_MISMATCH',issues:Object.freeze(['UNSUPPORTED_CELL_TYPE'])});
  }
  const columns=portalSourceColumns.PQRS_Master;
  const val = name => String(row[columns.indexOf(name)] ?? '').trim();
  const issues = [];
  if (!val('ID_PQRS')) issues.push('MISSING_SOURCE_ID');
  if (!val('ID_Copropiedad')) issues.push('MISSING_PROJECT_ID');
  if (!types.has(val('Tipo'))) issues.push('UNKNOWN_TYPE_OR_SHIFT');
  if (!priorities.has(val('Prioridad_Original'))) issues.push('UNKNOWN_ORIGINAL_PRIORITY_OR_SHIFT');
  if (!statuses.has(val('Estado_Actual'))) issues.push('UNKNOWN_STATUS_OR_SHIFT');
  const current = val('Prioridad_Actual');
  if (current === 'Pendiente') issues.push('UNRESOLVED_CURRENT_PRIORITY');
  else if (!priorities.has(current)) issues.push('UNKNOWN_CURRENT_PRIORITY_OR_SHIFT');
  const semanticUnknowns=issues.filter(v=>v.startsWith('UNKNOWN_')).length;
  const classification=issues.length===0 ? 'KNOWN_VALUES' :
    semanticUnknowns>=2 ? 'POSSIBLE_SHIFT_REVIEW' : 'UNRECOGNIZED_OR_INCOMPLETE_REVIEW';
  // Unknown values may be legitimate historic categories; flagged != corrupt.
  return Object.freeze({eligibleForAutomaticMapping:issues.length===0,
    classification,issues:Object.freeze(issues)});
}

export function summarizePortalPqrsRows(rows, options={}) {
  if (!Array.isArray(rows)) throw new TypeError('Rows must be an array');
  const counts = {};
  const classes = {};
  let flagged = 0;
  for (const row of rows) {
    const result = inspectPortalPqrsRow(row,options);
    if (!result.eligibleForAutomaticMapping) flagged++;
    classes[result.classification]=(classes[result.classification]??0)+1;
    for (const issue of result.issues) counts[issue] = (counts[issue] ?? 0) + 1;
  }
  return Object.freeze({inspected:rows.length,requiresReview:flagged,issueCounts:counts,classifications:classes});
}
