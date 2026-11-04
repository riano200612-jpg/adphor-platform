import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const config = readFileSync(new URL('../vite.config.js', import.meta.url), 'utf8');

test('QA demo pages are opt-in build inputs', () => {
  assert.match(config, /ADPHOR_BUILD_QA_DEMOS === 'true'/);
  assert.match(config, /'qa\/cliente': fileURLToPath/);
  assert.match(config, /'qa\/simulacion-operativa': fileURLToPath/);
});

test('remote QA deployment still requires protected staging opt-in', () => {
  assert.match(config, /ADPHOR_PROTECTED_STAGING_QA === 'true'/);
  assert.match(config, /QA_DEPLOY_BLOCKED/);
});


test('consolidated QA branch requires both staging and Access verification flags', () => {
  assert.match(config, /CF_PAGES_BRANCH === 'qa\/pqrs-carrusel-integracion-20261104'/);
  assert.match(config, /ADPHOR_QA_ACCESS_VERIFIED === 'true'/);
  assert.match(config, /!productionPages && !protectedStaging && !consolidatedQa/);
});

test('approved QA workflow forwards Access verification to the Vite build', () => {
  const workflow = readFileSync(new URL('../.github/workflows/checks.yml', import.meta.url), 'utf8');
  const buildStep = workflow.split('      - name: Build the approved preview SHA')[1]?.split('      - name: Publish only the configured QA branch')[0];
  assert.ok(buildStep, 'approved QA build step must exist');
  assert.match(buildStep, /ADPHOR_PROTECTED_STAGING_QA: 'true'/);
  assert.match(buildStep, /ADPHOR_QA_ACCESS_VERIFIED: \\$\\{\\{ vars\\.ADPHOR_QA_ACCESS_VERIFIED \\}\\}/);
  assert.match(workflow, /--project-name=adphor-platform/);
  assert.match(workflow, /--branch=qa\\/pqrs-carrusel-integracion-20261104/);
});
