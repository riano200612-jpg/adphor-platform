import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const ui=readFileSync(new URL('../src/js/ui-pqrs.js',import.meta.url),'utf8');
test('PQRS attachment picker accepts specified media and documents',()=>{
 for(const type of ['image/jpeg','image/png','image/webp','video/mp4','video/webm','application/pdf'])assert.ok(ui.includes(type),type);
 assert.match(ui,/type="file"/);
 assert.match(ui,/multiple/);
 assert.match(ui,/selectedEvidence\(\)/);
});
test('PQRS must never silently submit selected files without private storage',()=>{
 assert.match(ui,/if\(files.length\)throw Error\('No se puede radicar con adjuntos/);
 assert.match(ui,/delete payload.evidence/);
 assert.match(ui,/file.size>20\*1024\*1024/);
});

test('user can remove selected attachments and safely submit without upload',()=>{
 assert.match(ui,/data-clear-evidence/);
 assert.match(ui,/clearEvidence\.onclick=/);
 assert.match(ui,/evidenceInput\.value=''/);
 assert.match(ui,/clearEvidence\.hidden=!files\.length/);
});
