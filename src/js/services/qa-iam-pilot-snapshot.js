// QA-only adapter: reconciles the real email-keyed IAM tables with UUID-keyed
// membership checks. It does NOT grant access, invite anyone or verify JWTs.
// Feed only private, server-confirmed sources; never trust browser-supplied approval.
import { auditPilotReadiness } from './qa-pilot-readiness.js';

const norm = value => String(value ?? '').trim();
const email = value => norm(value).toLowerCase();
const eligibleEmail = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
const list = (value, label) => {
  if (!Array.isArray(value) || value.length > 5000 ||
      value.some(row => !row || typeof row !== 'object' || Array.isArray(row))) {
    throw Error('Fuente privada no verificable: ' + label);
  }
  return value;
};
function indexBy(rows, selector) {
  const index = new Map();
  for (const row of rows) {
    const key = selector(row);
    if (!key) continue;
    const bucket = index.get(key) || [];
    bucket.push(row);
    index.set(key, bucket);
  }
  return index;
}

/**
 * approvedIdentityLinks is a separate, server-verified decision record:
 * {legacyId,userId,email,ownerApproved,emailConfirmed,mfaFactorVerified}.
 * Do not manufacture it from legacy Correo, PIN, alias, user_metadata or UI state.
 * iamAccounts uses the ACTUAL QA schema: {email,user_id,status};
 * iamGrants uses the ACTUAL QA schema: {email,project_id,role}.
 * The admin role is scoped to a building, never corporate-admin.
 * READY_FOR_FUNCTIONAL_TEST remains provisional, not E2E/AAL2 proof.
 */
export function auditPilotIamSnapshot({
  properties, delegates, directory, approvedIdentityLinks, iamAccounts, iamGrants
} = {}) {
  for (const [name, value] of Object.entries({properties,delegates,directory,
    approvedIdentityLinks,iamAccounts,iamGrants})) list(value, name);

  const accountByEmail = indexBy(iamAccounts, account => email(account.email));
  const linkByLegacy = indexBy(approvedIdentityLinks, link => norm(link.legacyId));
  const verifiedDelegates = delegates.map(d => {
    const matches = linkByLegacy.get(norm(d.legacyId)) || [];
    const link = matches.length === 1 ? matches[0] : null;
    const address = email(link?.email);
    const userId = norm(link?.userId);
    const accountRows = accountByEmail.get(address) || [];
    const account = accountRows.length === 1 ? accountRows[0] : null;
    const confirmed = Boolean(link && eligibleEmail(address) && userId &&
      link.ownerApproved === true && link.emailConfirmed === true &&
      link.mfaFactorVerified === true && account && account.status === 'active' &&
      norm(account.user_id) === userId);
    return {
      legacyId:norm(d.legacyId), status:norm(d.status), role:norm(d.role),
      loginEmail:address, userId, loginEmailVerified:confirmed
    };
  });
  const uniqueUserOwners = indexBy(verifiedDelegates.filter(x => x.userId), x => x.userId);
  const conflictingOwners = [...uniqueUserOwners.values()].filter(rows =>
    new Set(rows.map(row => row.legacyId)).size > 1).length;
  const duplicateAccounts = [...accountByEmail.values()].filter(rows => rows.length !== 1).length;
  const duplicateLinks = [...linkByLegacy.values()].filter(rows => rows.length !== 1).length;

  // Unreviewed directory entries are not evidence of approved membership.
  const reviewedDirectory = directory.filter(row => row.reviewed === true).map(row => ({
    projectId:norm(row.projectId), legacyDelegateId:norm(row.legacyDelegateId),
    userId:norm(row.userId)
  }));
  const matchedGrants = [];
  let unmatchedGrants = 0;
  for (const grant of iamGrants) {
    const address = email(grant.email);
    const matches = accountByEmail.get(address) || [];
    if (!eligibleEmail(address) || matches.length !== 1 ||
        matches[0].status !== 'active' || !norm(matches[0].user_id)) {
      unmatchedGrants++;
      continue;
    }
    matchedGrants.push({
      projectId:norm(grant.project_id),
      userId:norm(matches[0].user_id),
      role:norm(grant.role)
    });
  }
  const audit = auditPilotReadiness({properties,delegates:verifiedDelegates,
    directory:reviewedDirectory,grants:matchedGrants});
  const globalConflict = unmatchedGrants + duplicateAccounts + duplicateLinks + conflictingOwners;
  return Object.freeze({
    ...audit,
    readyToTest:globalConflict ? 0 : audit.readyToTest,
    unmatchedGrants, duplicateAccounts, duplicateLinks, conflictingOwners,
    canProvision:false, canSendInvitations:false, certified:false,
    pipeline:'server-verified-email-to-uuid-reconciliation',
    warning:'Preflight únicamente: aprobación de identidad, AAL2 en sesión, IAM/RLS y E2E aún requieren certificación.'
  });
}
