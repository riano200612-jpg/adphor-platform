/** Operational migration gate for José's Apps Script sources.
 * Safe to ship: contains no source credentials, real names, identifiers or messages.
 * A source file is NEVER presumed publishable based only on keyword scanning.
 */
export const REQUIRED_LEGACY_FILES = Object.freeze({
  reuniones: Object.freeze(['appsscript.json','Calendario.js','Código.js','Correo.js','Index.html','Utilidades.js','MFA.js']),
  portal: Object.freeze(['appsscript.json','Calendario.js','Copropiedades.js','Correo.js','Código.js','Comunidad.html','GestionCorreos.html','GestionCorreosRegistro.html','Index.html','JavaScript.html','PortalHome.html','PQRS_Notificaciones.js','PQRS.js','PQRSForm.html','PQRSStatus.html','QuizCartagenaData.html','Registro.html','RegistroCorreo.html','ProcesadorPQRS.js','Reuniones.js','RevocacionCorreo.html','StyleSheet.html','Utilidades.js','VerificacionCorreo.html','Visitas.js'])
});
export function inspectLegacyInventory(paths) {
  if (!Array.isArray(paths)) throw new TypeError('Se requiere una lista de rutas');
  const normalized=new Set(paths.filter(x=>typeof x==='string').map(x=>x.replaceAll('\\','/').replace(/^\.\//,'')));
  const expected=Object.entries(REQUIRED_LEGACY_FILES).flatMap(([folder,files])=>files.map(file=>folder+'/'+file));
  return Object.freeze({
    expected:expected.length,
    found:expected.filter(x=>normalized.has(x)).length,
    missing:expected.filter(x=>!normalized.has(x)),
    unexpected: [...normalized].filter(x=>!expected.includes(x)),
    complete:expected.every(x=>normalized.has(x))
  });
}
export function migrationReady(checks) {
  return Boolean(checks && checks.inventoryComplete===true && checks.secretsReviewed===true &&
    checks.tenantIsolationTested===true && checks.authenticationTested===true &&
    checks.backupVerified===true && checks.browserE2ePassed===true);
}
