import test from 'node:test';
import assert from 'node:assert/strict';
import {calendarInstant,validateCalendarBusyIntervals,validateCalendarAvailabilityResponse,calendarHasConflict} from '../src/js/services/calendar-availability.js';
const event={start:'2026-11-14T15:00:00Z',end:'2026-11-14T16:00:00Z'};
test('calendar timestamps require a full valid date, time and known offset',()=>{
 for(const value of [undefined,null,0,'2026-11-14','2026-11-14T15:00:00','2026-11-14T15:00Z','2026-11-14T15:00:00.0009Z','2026-11-14T15:00:00-00:00','2026-02-30T15:00:00Z','2025-02-29T15:00:00Z','2026-11-14T24:00:00Z','2026-11-14T15:60:00Z','2026-11-14T15:00:00+24:00',' 2026-11-14T15:00:00Z'])assert.ok(Number.isNaN(calendarInstant(value)),String(value));
 assert.equal(calendarInstant('2026-11-14T10:00:00-05:00'),Date.parse(event.start));
 assert.equal(calendarInstant('2024-02-29T15:00:00.123Z'),Date.parse('2024-02-29T15:00:00.123Z'));
});
test('busy intervals reject incomplete, reversed, null, sparse and timezone-free provider responses',()=>{
 for(const busy of [null,{},[null],[{}],[{start:event.start}],[{...event,end:event.start}],[{start:event.end,end:event.start}],[{...event,start:'2026-11-14T15:00:00'}],Array(1)])assert.throws(()=>validateCalendarBusyIntervals(busy));
 assert.deepEqual(validateCalendarBusyIntervals([]),[]);
});
test('availability envelope requires the requested property, timezone and busy array',()=>{
 const valid={project_id:'p1',timezone:'America/Bogota',busy:[event]};
 assert.deepEqual(validateCalendarAvailabilityResponse(valid,'p1'),[event]);
 for(const override of [{project_id:'p2'},{timezone:undefined},{timezone:'UTC'},{busy:undefined}])assert.throws(()=>validateCalendarAvailabilityResponse({...valid,...override},'p1'));
 assert.throws(()=>validateCalendarAvailabilityResponse(null,'p1'));
 assert.throws(()=>validateCalendarAvailabilityResponse({timezone:'America/Bogota',busy:[]},undefined));
});
test('manual checks preserve both 30-minute boundaries and do not turn bad intervals into free time',()=>{
 const run=(start,end,busy=[event])=>calendarHasConflict({busy,start,end});
 assert.equal(run('2026-11-14T16:30:00Z','2026-11-14T17:30:00Z'),false);
 assert.equal(run('2026-11-14T16:29:59Z','2026-11-14T17:30:00Z'),true);
 assert.equal(run('2026-11-14T13:30:00Z','2026-11-14T14:30:00Z'),false);
 assert.equal(run('2026-11-14T13:30:00Z','2026-11-14T14:30:01Z'),true);
 assert.throws(()=>run(event.start,event.end,[{start:'bad',end:'bad'}]));
 assert.throws(()=>run(event.start,event.start));
});
test('validated intervals are cloned without modifying provider data',()=>{
 const input=Object.freeze([Object.freeze({...event,privateField:'not returned'})]);
 const out=validateCalendarBusyIntervals(input);assert.deepEqual(out,[event]);assert.notEqual(out[0],input[0]);
});
