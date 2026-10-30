/** Contrato de compatibilidad para migrar las dos aplicaciones Apps Script de ADPHOR.
 * Sin Google Script API ni escrituras. Cualquier llamada real requiere sesión Supabase
 * y control de membresía del proyecto en el backend.
 */
export const LEGACY_MODULES=Object.freeze({
  reuniones: ['agendar','editar','eliminar','confirmar','consultar'],
  pqrs: ['form','gestion-correos','status'],
});
export const LEGACY_ROUTES=Object.freeze({
  form: '/pqrs/radicar',
  'gestion-correos': '/pqrs/correos',
  status: '/pqrs/calificar',
});
export function resolveLegacyRoute(page) {
  if (typeof page !== 'string') return null;
  return Object.prototype.hasOwnProperty.call(LEGACY_ROUTES,page)
    ? LEGACY_ROUTES[page] : null;
}
export function normalizePriority(value) {
  const lookup={alto:'alto',alta:'alto',medio:'medio',media:'medio',bajo:'bajo',baja:'bajo'};
  const key=String(value??'').trim().toLocaleLowerCase('es');
  if (!Object.prototype.hasOwnProperty.call(lookup,key)) throw new Error('Prioridad inválida');
  return lookup[key];
}
export function requireProjectAccess({projectId,memberProjectIds}) {
  if (!projectId || !Array.isArray(memberProjectIds) || !memberProjectIds.includes(projectId)) {
    throw new Error('Acceso a copropiedad no autorizado');
  }
  return projectId;
}
