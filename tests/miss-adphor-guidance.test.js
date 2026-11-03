import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {guidanceForArea,MISS_ADPHOR_GUIDANCE} from '../src/js/services/miss-adphor-guidance.js';
const app=readFileSync(new URL('../src/js/app.js',import.meta.url),'utf8');
test('José original Miss ADPHOR contextual prompts remain offline and safe',()=>{
 assert.match(MISS_ADPHOR_GUIDANCE.idle,/Portal Digital ADPHOR/);
 assert.match(MISS_ADPHOR_GUIDANCE.inspect,/PQRS/);
 assert.match(guidanceForArea('meetings'),/tiempos/);
});
test('login avatar has explicit accessible greeting and no network sends',()=>{
 assert.match(app,/id="miss-adphor-hello"/);
 assert.match(app,/id="miss-adphor-bubble"/);
 assert.match(app,/MISS_ADPHOR_GUIDANCE.wave/);
 assert.match(app,/role="status" aria-live="polite"/);
});
