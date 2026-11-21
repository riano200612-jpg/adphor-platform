import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
for(const key of ['CF_PAGES','WORKERS_CI']) test(`unapproved cloud build blocked: ${key}`,()=>{
 const result=spawnSync(process.execPath,['--input-type=module','-e',"await import('./vite.config.js')"],{encoding:'utf8',env:{...process.env,[key]:'1'}});
 assert.notEqual(result.status,0);assert.match(result.stderr,/QA_DEPLOY_BLOCKED/);
});
