import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../qa/datos-reales.html',import.meta.url),'utf8');
const vite=readFileSync(new URL('../vite.config.js',import.meta.url),'utf8');
test('private real-data page is never included in default build',()=>{
 assert.match(vite,/ADPHOR_BUILD_QA_DEMOS === 'true'/);
 assert.match(vite,/'qa\/datos-reales': fileURLToPath/);
});
test('real values are requested from server only after login and admin role checks',()=>{
 assert.match(html,/client\.auth\.signInWithPassword/);
 assert.match(html,/functions\/v1\/qa-client-readonly-snapshot/);
 assert.match(html,/read_only_verified_real_data/);
 assert.match(html,/rol administrador/);
});
test('never embed sensitive source data, access tokens or shortcuts into public code',()=>{
 assert.doesNotMatch(html,/sb_secret_|service_role|clave fija|PIN hash|Fotos Delegados/);
 assert.match(html,/credentials:'omit'/);
 assert.match(html,/cache:'no-store'/);
 assert.match(html,/textContent=p/);
});
