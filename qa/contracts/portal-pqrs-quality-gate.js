// QA-only source quality gate: classify anomalies without altering or logging original row content.
// Portal's historical versions can shift fields; do not automatically repair them by position.
import {portalSourceColumns} from './portal-source-columns.js';

const types = new Set(['Petición', 'Queja', 'Reclamo', 'Sugerencia']);
const priorities = new Set(['Baja', 'Media', 'Alta', 'Crítica']);
const statuses = new Set(['Recibida', 'En Evaluación', 'Atendida (R)', 'Resuelta', 'Cerrada']);

export function inspectPortalPqrsRow(row) {
  if (!Array.isArray(row)) throw new TypeError('PQRS row must be an array');
  const columns = portalSourceColumns.PQRS_Master;
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
  return Object.freeze({eligibleForAutomaticMapping: issues.length === 0, issues: Object.freeze(issues)});
}

export function summarizePortalPqrsRows(rows) {
  if (!Array.isArray(rows)) throw new TypeError('Rows must be an array');
  const counts = {};
  let flagged = 0;
  for (const row of rows) {
    const result = inspectPortalPqrsRow(row);
    if (!result.eligibleForAutomaticMapping) flagged++;
    for (const issue of result.issues) counts[issue] = (counts[issue] ?? 0) + 1;
  }
  return {inspected: rows.length, requiresReview: flagged, issueCounts: counts};
}
