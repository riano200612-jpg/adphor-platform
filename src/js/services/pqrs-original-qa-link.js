// QA Integral: acceso administrativo al Apps Script ya publicado por el cliente.
// No emite correos, no crea PQRS y no cambia el código original de José.
// Fail-closed: el fallback solo se ofrece en el alias QA exacto y al rol admin.
import {normalizeAppsScriptExecUrl} from '../ui-client-legacy-bridge.js';
export const QA_INTEGRAL_PQRS_EXEC='https://script.google.com/macros/s/AKfycbxw64JyydOaye-GksILdtYO4KvshS3OrNW6lXAKmq_Q/exec';
const QA_ALIAS='qa-integral-claude-reviewed.adphor-platform.pages.dev';
export function resolveOriginalPqrsExec({environment='',stored='',hostname='',role=''}={}){
  if(typeof environment==='string'&&environment.trim())return normalizeAppsScriptExecUrl(environment);
  if(typeof stored==='string'&&stored.trim())return normalizeAppsScriptExecUrl(stored);
  if(hostname===QA_ALIAS&&role==='admin')return normalizeAppsScriptExecUrl(QA_INTEGRAL_PQRS_EXEC);
  return '';
}
