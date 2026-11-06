import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../qa/datos-reales.html',import.meta.url),'utf8');
test('real-data page is locked to QA and never labels missing historical data as zero',()=>{
 assert.ok(html.includes("url==='https://qfctnnnnltghepwujpdm.supabase.co'"));
 assert.ok(html.includes("v!==null&&v!==undefined"));
 assert.ok(html.includes("No integrado"));
 assert.ok(html.includes("Reuniones, visitas, PQRS y personal originales no están sincronizados"));
});
test('client MFA enrollment requires authorized interactive browser and does not log secrets',()=>{
 assert.ok(html.includes("client.auth.mfa.enroll({factorType:'totp'"));
 assert.ok(html.includes("client.auth.mfa.challengeAndVerify("));
 assert.ok(html.includes("img.src=qr"));
 assert.ok(html.includes("mfaQr').replaceChildren()"));
 assert.ok(!html.includes('console.log('));
});
