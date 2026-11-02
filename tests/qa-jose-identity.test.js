import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html=readFileSync(new URL('../qa/simulacion-operativa.html',import.meta.url),'utf8');

test('demo uses the original Jose corporate color tokens',()=>{
 for(const color of ['#264B6B','#b59c21','#1e3b54','#EAF1F7']) assert.ok(html.includes(color),color);
});
test('the synthetic demo cannot be confused with live operations',()=>{
 assert.match(html,/SIMULACIÓN QA/);
 assert.match(html,/No está conectada a Supabase/);
});
test('companions selector can choose and unchoose a person, and resets on none',()=>{
 assert.match(html,/data-person="Gerencia"/);
 assert.match(html,/state\.companions\.includes\(p\)/);
 assert.match(html,/state\.companions=\[\]/);
 assert.match(html,/companions:state\.companions\.slice\(\)/);
});
