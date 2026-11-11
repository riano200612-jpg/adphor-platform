import test from 'node:test';
import assert from 'node:assert/strict';
import { suggestMeetingSlots } from '../src/js/services/meeting-slot-suggestions.js';
const start = '2026-11-14T15:00:00.000Z';
const run = (busy, extra = {}) => suggestMeetingSlots({ busy, start, durationMinutes: 60, verifiedWindow:{start:"2026-11-14T14:30:00Z",end:"2026-11-16T16:30:00Z"}, ...extra });

test('suggests future slots without claiming a booking', () => {
  const out = run([]);
  assert.equal(out.length, 5);
  assert.equal(out[0].start, '2026-11-14T15:30:00.000Z');
  assert.equal(out[0].end, '2026-11-14T16:30:00.000Z');
});
test('respects 30-minute conflict margins, including exact boundary', () => {
  const out = run([{start:'2026-11-14T16:00:00Z',end:'2026-11-14T17:00:00Z'}]);
  assert.equal(out[0].start, '2026-11-14T17:30:00.000Z');
});
test('rejects malformed availability rather than reporting false free slots', () => {
  assert.throws(() => run({busy:[]}), /no es válida/);
  assert.throws(() => run([{start:'invalid',end:start}]), /no válido/);
  assert.throws(() => run([{start:start,end:start}]), /no válido/);
});
test('validates duration and suggestion bounds', () => {
  assert.throws(() => run([],{durationMinutes:0}), /Duración/);
  assert.throws(() => run([],{durationMinutes:721}), /Duración/);
  assert.throws(() => run([],{limit:11}), /Límite/);
});
test('returns no suggestions when busy blocks the whole candidate horizon', () => {
  assert.deepEqual(run([{start:'2026-11-14T00:00:00Z',end:'2026-11-18T00:00:00Z'}]), []);
});

test('suggestions stay wholly inside the queried interval including both buffers',()=>{
 const out=run([],{verifiedWindow:{start:'2026-11-14T15:00:00Z',end:'2026-11-14T17:00:00Z'}});
 assert.deepEqual(out,[{start:'2026-11-14T15:30:00.000Z',end:'2026-11-14T16:30:00.000Z'}]);
 assert.throws(()=>run([],{verifiedWindow:undefined}),/intervalo/);
 assert.throws(()=>run([],{limit:6}),/Límite/);
});
test('bad null and timezone-free busy intervals cannot become availability',()=>{
 assert.throws(()=>run([null]),/no válido/);
 assert.throws(()=>run([{start:'2026-11-14T15:00',end:'2026-11-14T16:00'}]),/no válido/);
});
test('does not mutate or reorder busy intervals and enforces the far end buffer',()=>{
 const busy=Object.freeze([Object.freeze({start:'2026-11-14T16:00:00Z',end:'2026-11-14T17:00:00Z'})]);
 const out=run(busy);
 for(const slot of out){assert.ok(Date.parse(slot.start)>=Date.parse(busy[0].end)+1800000);}
 assert.equal(busy[0].start,'2026-11-14T16:00:00Z');
});
