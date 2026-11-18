// QA Integral: property administration never implies corporate IAM authority.
// UI visibility is not an authorization boundary: server RLS and IAM checks remain mandatory.
const GENERAL_ONLY_PAGES = new Set(['qa-source', 'access-audit']);

export function delegateAdminLabel(isGeneralAdmin=false) {
  return isGeneralAdmin === true ? 'Administrador general' : 'Delegado · Administrador de copropiedad';
}

export function corporatePageAllowed(page, isGeneralAdmin=false) {
  return !GENERAL_ONLY_PAGES.has(page) || isGeneralAdmin === true;
}

export async function verifyGeneralAdmin(iam, {eligible=false}={}) {
  if(eligible !== true || !iam || typeof iam.read !== 'function')return false;
  try {
    // The server authorizes only confirmed, active technical admins with MFA AAL2.
    const evidence = await iam.read();
    return evidence?.enabled === true && Array.isArray(evidence.accounts) && Array.isArray(evidence.audit);
  } catch {
    // A disabled service, AAL1 or restricted property admin always fails closed.
    return false;
  }
}
