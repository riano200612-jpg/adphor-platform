// Authorization contract for AI recommendations, NOT a substitute for SQL RLS.
// A service/agent principal is always denied sensitive effects, regardless of review state.
export function authorizeSensitiveEffect({ actor, action, review, projectId, runId, fingerprint }) {
  const allowed = new Set(['close-ticket','publish-report','send-notification']);
  if (!allowed.has(action)) return { allowed: false, reason: 'unknown_action' };
  if (!actor || actor.kind !== 'human' || actor.mfaVerified !== true ||
      actor.role !== 'admin' || typeof actor.id !== 'string' || !actor.id.trim()) {
    return { allowed: false, reason: 'human_admin_required' };
  }
  if (!projectId || !runId || !fingerprint || typeof fingerprint !== 'string') {
    return { allowed: false, reason: 'missing_context' };
  }
  if (!review || review.decision !== 'approved' ||
      review.projectId !== projectId || review.runId !== runId ||
      review.fingerprint !== fingerprint || review.administratorId !== actor.id) {
    return { allowed: false, reason: 'matching_review_required' };
  }
  return { allowed: true, reason: 'requires_server_side_revalidation' };
}
