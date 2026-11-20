// QA-only, read-only preflight. Never creates users, grants, passwords or invitations.
// Input must be gathered from PRIVATE, authorized sources. This is not an RLS grant.
const norm = value => String(value ?? '').trim();
const fold = value => norm(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const enabled = new Set(['activo', 'activa', 'active', 'habilitado', 'habilitada']);
const delegateRoles = new Set(['d', 'delegado', 'delegada']);
const grantRoles = new Set(['delegate', 'delegado', 'delegada', 'admin']);
const limited = (rows, label) => {
  if (!Array.isArray(rows) || rows.length > 5000) throw Error('Fuente incompleta o inválida: ' + label);
  if (rows.some(row => !row || typeof row !== 'object' || Array.isArray(row)))
    throw Error('Registro inválido: ' + label);
  return rows;
};
const result = (projectId, status) => Object.freeze({projectId, status});

export function auditPilotReadiness({properties, delegates, directory = [], grants = []} = {}) {
  limited(properties, 'copropiedades');
  limited(delegates, 'delegadas');
  limited(directory, 'directorio');
  limited(grants, 'concesiones');
  const projectIds = properties.map(p => norm(p.projectId));
  if (!projectIds.length || projectIds.some(id => !id) ||
      new Set(projectIds).size !== projectIds.length)
    throw Error('Inventario de copropiedades duplicado o inválido.');

  const delegateIndex = new Map();
  const emailIndex = new Map();
  for (const d of delegates) {
    const id = norm(d.legacyId);
    if (!id) continue;
    if (!delegateIndex.has(id)) delegateIndex.set(id, []);
    delegateIndex.get(id).push(d);
    const email = fold(d.loginEmail);
    if (email) {
      if (!emailIndex.has(email)) emailIndex.set(email, new Set());
      emailIndex.get(email).add(id);
    }
  }
  const byProject = new Map();
  for (const link of directory) {
    const projectId = norm(link.projectId);
    if (!byProject.has(projectId)) byProject.set(projectId, []);
    byProject.get(projectId).push(link);
  }
  const grantsByProject = new Map();
  for (const grant of grants) {
    const projectId = norm(grant.projectId);
    if (!grantsByProject.has(projectId)) grantsByProject.set(projectId, []);
    grantsByProject.get(projectId).push(grant);
  }
  const entries = [];
  const approvedPairs = new Set();
  const projected = new Map();
  for (const property of properties) {
    const projectId = norm(property.projectId);
    const legacyId = norm(property.legacyDelegateId);
    let status = 'MISSING_DELEGATE';
    const matches = delegateIndex.get(legacyId) || [];
    const d = matches.length === 1 ? matches[0] : null;
    if (legacyId && matches.length !== 1) status = 'IDENTITY_REVIEW_REQUIRED';
    else if (d) {
      const state = fold(d.status);
      const role = fold(d.role);
      const email = fold(d.loginEmail);
      const userId = norm(d.userId);
      const links = byProject.get(projectId) || [];
      const ownGrants = grantsByProject.get(projectId) || [];
      if (state === 'bloqueado' || state === 'bloqueada' || state === 'blocked')
        status = 'SOURCE_BLOCKED';
      else if (!enabled.has(state))
        status = 'SOURCE_INACTIVE';
      else if (!delegateRoles.has(role))
        status = 'ROLE_REVIEW_REQUIRED';
      else if (!email || (emailIndex.get(email)?.size || 0) > 1)
        status = 'SHARED_OR_MISSING_LOGIN_EMAIL';
      else if (d.loginEmailVerified !== true)
        status = 'LOGIN_EMAIL_UNVERIFIED';
      else if (!userId)
        status = 'AUTH_LINK_MISSING';
      else if (links.length !== 1 || norm(links[0].userId) !== userId ||
        (norm(links[0].legacyDelegateId) && norm(links[0].legacyDelegateId) !== legacyId))
        status = 'DIRECTORY_NOT_RECONCILED';
      else if (ownGrants.length === 0)
        status = 'GRANT_PENDING';
      else if (ownGrants.length !== 1 || norm(ownGrants[0].userId) !== userId ||
        !grantRoles.has(fold(ownGrants[0].role)))
        status = 'GRANT_REVIEW_REQUIRED';
      else {
        status = 'READY_FOR_FUNCTIONAL_TEST';
        approvedPairs.add(projectId + '|' + userId);
      }
      if (userId && enabled.has(state) && delegateRoles.has(role)) {
        if (!projected.has(userId)) projected.set(userId, new Set());
        projected.get(userId).add(projectId);
      }
    }
    entries.push(result(projectId, status));
  }
  // Detect unexpected grants without disclosing identities, aliases or email addresses.
  const outOfScopeGrants = grants.filter(g =>
    !projected.get(norm(g.userId))?.has(norm(g.projectId))).length;
  const counts = {};
  for (const item of entries) counts[item.status] = (counts[item.status] || 0) + 1;
  return Object.freeze({
    source: 'qa-private-preflight', readonly: true, canProvision: false,
    totalProperties: entries.length, counts: Object.freeze(counts),
    entries: Object.freeze(entries), outOfScopeGrants,
    readyToTest: (counts.READY_FOR_FUNCTIONAL_TEST || 0),
    certified: false,
    warning: 'Requiere validación de fuente, autorización de propietario, IAM servidor, MFA y RLS.'
  });
}
