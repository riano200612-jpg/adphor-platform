import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateGauntlet, canShareClientPreview, GAUNTLET_STAGES } from '../qa/gauntlet-gates.js';

test('unknown stages and missing checks block publication', () => {
  const result = evaluateGauntlet({});
  assert.equal(result.approved, false);
  assert.equal(result.outcomes.length, GAUNTLET_STAGES.length);
  assert.ok(result.outcomes.every(x => x.status === 'pending'));
});

test('a failed security review is never approved', () => {
  const checks = Object.fromEntries(GAUNTLET_STAGES.map(x => [x, true]));
  checks['security-review'] = false;
  assert.equal(evaluateGauntlet(checks).approved, false);
});

test('all checks passed still require Access, synthetic data and HTTPS proof', () => {
  const checks = Object.fromEntries(GAUNTLET_STAGES.map(x => [x, true]));
  const gauntlet = evaluateGauntlet(checks);
  assert.equal(gauntlet.approved, true);
  assert.equal(canShareClientPreview({gauntlet,accessProtected:false,syntheticOnly:true,testedHttps:true}),false);
  assert.equal(canShareClientPreview({gauntlet,accessProtected:true,syntheticOnly:false,testedHttps:true}),false);
  assert.equal(canShareClientPreview({gauntlet,accessProtected:true,syntheticOnly:true,testedHttps:false}),false);
  assert.equal(canShareClientPreview({gauntlet,accessProtected:true,syntheticOnly:true,testedHttps:true}),true);
});

test('invalid checks are rejected', () => {
  assert.throws(() => evaluateGauntlet(null),TypeError);
  assert.throws(() => evaluateGauntlet([]),TypeError);
});
