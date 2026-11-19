import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('IAM search lists only requested grants without prechecking 43 properties',()=>{
 const s=source('src/js/ui-iam-live.js');
 assert.match(s,/const limit=8/);
 assert.match(s,/row\.line\.hidden=!show/);
 assert.match(s,/const getSelected=\(\)=>rows\.filter\(row=>row\.checkbox\.checked\)/);
 assert.match(s,/for\(const row of rows\)\{row\.checkbox\.checked=false;row\.role\.value='viewer';\}/);
 assert.match(s,/getSelected\.focusSearch=\(\)=>search\.focus\(\)/);
 assert.match(s,/Marca solo las copropiedades autorizadas/);
 assert.match(s,/showFieldError\(invite,/);
 assert.match(s,/showFieldError\(grants,/);
 assert.match(s,/showFieldError\(removal,/);
 assert.match(s,/await iam\.command|iam\.command\(/);
});
test('Visitas provides native date by default and alternative behind explicit details',()=>{
 const s=source('src/js/ui-visit-preparation.js');
 assert.match(s,/<details class="visit-manual-date">/);
 assert.match(s,/<summary>Prefiero escribir la fecha y hora<\/summary>/);
 assert.match(s,/type="datetime-local" required/);
 assert.match(s,/type="text" maxlength="16"/);
 assert.match(s,/fields\.addEventListener\('change',update\)/);
 assert.match(s,/formHint\.textContent=advice/);
 assert.match(s,/repository\.save\(request\)/);
});
test('PQRS required field feedback keeps existing PostgreSQL and evidence paths',()=>{
 const s=source('src/js/ui-pqrs.js');
 assert.match(s,/form\.addEventListener\('invalid'/);
 assert.match(s,/fieldError\.setAttribute\('role','alert'\)/);
 assert.match(s,/Escribe un asunto de al menos tres caracteres/);
 assert.match(s,/Explica qué ocurrió y qué solución necesitas/);
 assert.match(s,/form\.elements\.subject\.validity\.valid/);
 assert.match(s,/const saved=pendingCase\|\|await repository\.create/);
 assert.match(s,/await uploadPrivateEvidence\(/);
});
test('safe forms do not alter original Calendar, authentication, database schemas or global permissions',()=>{
 const iam=source('src/js/ui-iam-live.js'),visit=source('src/js/ui-visit-preparation.js'),pqrs=source('src/js/ui-pqrs.js');
 assert.ok(!/service_role|auth\.admin|google\.com\/calendar|cron\.schedule/i.test(iam+visit+pqrs));
 assert.match(iam,/if\(!window\.confirm\(/);
 assert.match(iam,/run\('invite'/);
 assert.match(visit,/canCreate/);
});
