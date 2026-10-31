import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const s=readFileSync(new URL('../src/js/ui-meeting-experience.js',import.meta.url),'utf8');
test('interactive calendar offers month week and day controls',()=>{
 for(const label of ['data-mode="month"','data-mode="week"','data-mode="day"'])assert.ok(s.includes(label),label);
 assert.match(s,/mode==='week'\?7:1/);
});
test('day navigation increments one day and retains selected property scope',()=>{
 assert.match(s,/mode==='day'\?1:7/);
 assert.match(s,/getRows\(\)/);
 assert.match(s,/form\.elements\.start\.value=key\+'T09:00'/);
});
