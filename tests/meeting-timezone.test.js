import {test} from 'node:test';import assert from 'node:assert/strict';import {bogotaInput,bogotaInstant} from '../src/js/ui-meeting-experience.js';
test('meeting input is always Bogota, independent of browser timezone',()=>{assert.equal(bogotaInstant('2026-11-05T09:00').toISOString(),'2026-11-05T14:00:00.000Z');assert.equal(bogotaInput('2026-11-05T14:00:00Z'),'2026-11-05T09:00');});
test('meeting dates reject calendar rollover and malformed values',()=>{for(const d of ['2026-02-30T09:00','2026-11-05T25:00','','bad'])assert.throws(()=>bogotaInstant(d));});
