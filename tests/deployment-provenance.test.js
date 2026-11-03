import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ADPHOR_DEPLOY_SHA,ADPHOR_DEPLOY_LABEL} from '../src/js/services/deployment-version.js';

const load=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('deployment provenance uses only validated Cloudflare Pages commit SHA',()=>{
 const vite=load('vite.config.js');
 assert.match(vite,/CF_PAGES_COMMIT_SHA/);
 assert.match(vite,/\^\[a-f0-9\]\{40\}\$/);
 assert.match(vite,/__ADPHOR_BUILD_SHA__/);
 assert.equal(ADPHOR_DEPLOY_SHA,'');
 assert.equal(ADPHOR_DEPLOY_LABEL,'Versión sin SHA verificable');
});
test('login and authenticated shell disclose the same deployed commit label',()=>{
 const app=load('src/js/app.js');
 const matches=app.match(/data-build-version/g)||[];
 assert.equal(matches.length,2);
 assert.match(app,/import \{ADPHOR_DEPLOY_LABEL\}/);
 assert.equal(app.includes('CF_PAGES_COMMIT_SHA'),false);
});
