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
  } catch {
    // A disabled service, AAL1 or restricted property admin always fails closed.
    inform('unavailable');
    return false;
  }
}
export function corporateAccessNotice(status) {
  return status==='unavailable'
    ? 'No se pudo verificar la gestión general. Usa «Actualizar datos» para volver a comprobar tu sesión y MFA.'
    : status==='unverified'
      ? 'El servicio no confirmó la administración general para esta sesión.'
      : '';
}
