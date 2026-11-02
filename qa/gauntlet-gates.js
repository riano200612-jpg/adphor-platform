// Contract for a repeatable, human-reviewed ADPHOR QA gauntlet.
// This is process metadata, not authorization for cloud deployment or database writes.
export const GAUNTLET_STAGES = Object.freeze([
  'inspect',
  'implement',
  'unit-test',
  'security-review',
  'integration-test',
  'human-approval',
]);

export function evaluateGauntlet(checks) {
  if (!checks || typeof checks !== 'object' || Array.isArray(checks)) {
    throw new TypeError('QA checks must be a named object');
  }
  const outcomes = GAUNTLET_STAGES.map(stage => ({
    stage,
    status: checks[stage] === true ? 'passed' : checks[stage] === false ? 'failed' : 'pending',
  }));
  const approved = outcomes.every(item => item.status === 'passed');
  return Object.freeze({ status: approved ? 'ready-for-review' : 'blocked', approved, outcomes });
}

export function canShareClientPreview({gauntlet, accessProtected, syntheticOnly, testedHttps}) {
  return gauntlet?.approved === true &&
    accessProtected === true &&
    syntheticOnly === true &&
    testedHttps === true;
}
