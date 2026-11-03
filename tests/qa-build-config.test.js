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
