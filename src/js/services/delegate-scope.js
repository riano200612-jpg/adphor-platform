// QA Integral: property administration never implies corporate IAM authority.
// UI visibility is not an authorization boundary: server RLS and IAM checks remain mandatory.
const GENERAL_ONLY_PAGES = new Set(['qa-source', 'access-audit']);

export function delegateAdminLabel(isGeneralAdmin=false) {
  return isGeneralAdmin === true ? 'Administrador general' : 'Delegado · Administrador de copropiedad';
}

export function corporatePageAllowed(page, isGeneralAdmin=false) {
  return !GENERAL_ONLY_PAGES.has(page) || isGeneralAdmin === true;
}

// Read-only UI diagnostics; only the authorized IAM backend can grant access.
// Generic statuses contain no tokens, emails or other privileged data.
export async function verifyGeneralAdmin(iam, {eligible=false,reportStatus=null}={}) {
  const inform=status=>{if(typeof reportStatus==='function')reportStatus(status);};
  if(eligible !== true || !iam || typeof iam.read !== 'function'){
    inform('not-eligible');return false;
  }
  try {
    // The server authorizes only confirmed, active technical admins with MFA AAL2.
    const evidence = await iam.read();
    const verified=evidence?.enabled === true &&
      Array.isArray(evidence.accounts) && Array.isArray(evidence.audit);
    inform(verified?'verified':'unverified');
    return verified;
  } catch (error) {
    // A disabled service, AAL1 or restricted property admin always fails closed.
    const status=error?.status;
    if(Number.isInteger(status) && status>=400 && status<=599) inform('http-'+status);
    else if(error?.code==='IAM_TRANSPORT') inform('transport');
    else if(error?.code==='IAM_SESSION') inform('session');
    else inform('unavailable');
    return false;
  }
}
export function corporateAccessNotice(status) {
 if(status==='transport') return 'El navegador no recibió una respuesta del servicio de usuarios. Usa «Actualizar datos» para reintentar.';
 if(status==='session') return 'El servicio de usuarios necesita una sesión iniciada. Verifica tu ingreso a QA.';
 if (/^http-[45][0-9]{2}$/.test(status)) {
   const code=status.slice(5);
   const explanation=code==='401' ? 'La sesión necesita validación.' :
     code==='403' ? 'El servicio denegó el acceso de esta sesión.' :
     'El servicio de usuarios no pudo completar la consulta.';
   return explanation+' (HTTP '+code+'). Usa «Actualizar datos» para reintentar.';
 }
 return status==='unavailable'
    ? 'No se pudo verificar la gestión general. Usa «Actualizar datos» para volver a comprobar tu sesión y MFA.'
    : status==='unverified'
      ? 'El servicio no confirmó la administración general para esta sesión.'
      : '';
}
