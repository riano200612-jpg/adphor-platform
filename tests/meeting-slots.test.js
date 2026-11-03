import test from 'node:test';import assert from 'node:assert/strict';import {hasMeetingConflict,getSyntheticSlots} from '../qa/meeting-slots.mjs';import {readFileSync} from 'node:fs';
const meetings=[{date:'2026-11-04',time:'09:00',property:'Porto Castello',durationMinutes:60}];const request={date:'2026-11-04',property:'Porto Castello',durationMinutes:60};
test('Jose: overlapping time blocked',()=>assert.equal(hasMeetingConflict({...request,time:'09:30'},meetings),true));
test('Jose: 30-minute buffer',()=>{assert.equal(hasMeetingConflict({...request,time:'10:29'},meetings),true);assert.equal(hasMeetingConflict({...request,time:'10:30'},meetings),false)});
test('property isolation',()=>assert.equal(hasMeetingConflict({...request,property:'Other',time:'09:00'},meetings),false));
test('synthetic slot suggestions',()=>assert.deepEqual(getSyntheticSlots(request,meetings),['11:00','15:00']));
test('invalid data blocked',()=>assert.throws(()=>hasMeetingConflict({...request,time:'bad'},meetings)));
test('QA meeting view loads schedule module and rechecks on submission',()=>{const html=readFileSync(new URL('../qa/simulacion-operativa.html',import.meta.url),'utf8');assert.match(html,/import \{getSyntheticSlots,hasMeetingConflict\}/);assert.match(html,/refreshSyntheticSlots/);assert.match(html,/if\(hasMeetingConflict/);});
