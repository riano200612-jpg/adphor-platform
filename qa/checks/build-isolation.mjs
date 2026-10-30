import {execFileSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import assert from 'node:assert/strict';
const build=flag=>execFileSync(process.execPath,['node_modules/vite/bin/vite.js','build'],{env:{...process.env,ADPHOR_BUILD_QA_DEMOS:flag},stdio:'pipe'});
build('false');assert.ok(existsSync('dist/index.html'));assert.equal(existsSync('dist/qa/cliente.html'),false);
build('true');assert.ok(existsSync('dist/qa/cliente.html'));
build('false');assert.equal(existsSync('dist/qa/cliente.html'),false);
console.log('3 build isolation checks PASS (default, opt-in, stale artifact removal)');
