import test from 'node:test';
import assert from 'node:assert/strict';
import {loadMeetingSlotSuggestions} from '../src/js/services/meeting-slot-suggestions.js';
const start='2026-11-14T15:00:00Z',now=Date.parse('2026-11-11T15:00:00Z');
const options={projectId:'p1',start,durationMinutes:60,now};
test('read-only suggestions query the selected property and the complete buffered horizon',async()=>{
 const calls=[];const repo={meetingAvailability:async(...args)=>{calls.push(args);return [];}};
 const {slots,verifiedWindow}=await loadMeetingSlotSuggestions({...options,repo});
 assert.deepEqual(calls,[['p1','2026-11-14T14:30:00.000Z','2026-11-16T16:30:00.000Z']]);
 assert.equal(slots.length,5);assert.equal(verifiedWindow.start,calls[0][1]);
 assert.deepEqual(Object.keys(slots[0]).sort(),['end','start']);
});
test('an OAuth/provider failure or malformed response yields no suggestion result',async()=>{
 await assert.rejects(loadMeetingSlotSuggestions({...options,repo:{meetingAvailability:async()=>{throw Error('fixture service unavailable');}}}),/unavailable/);
 await assert.rejects(loadMeetingSlotSuggestions({...options,repo:{meetingAvailability:async()=>({busy:[]})}}),/no es válida/);
 await assert.rejects(loadMeetingSlotSuggestions({...options,repo:{meetingAvailability:async()=>[null]}}),/no válido/);
});
test('invalid input and less than 24 hours lead time are rejected before any service call',async()=>{
 let calls=0;const repo={meetingAvailability:async()=>{calls++;return [];}};
 for(const override of [{projectId:''},{durationMinutes:0},{start:'invalid'},{now:Date.parse(start)-86399999}]){
  await assert.rejects(loadMeetingSlotSuggestions({...options,repo,...override}));
 }
 assert.equal(calls,0);
 await assert.rejects(loadMeetingSlotSuggestions({...options,repo:{}}),/servicio autorizados/);
});
test('an entirely busy horizon is a successful empty result, not an error',async()=>{
 const repo={meetingAvailability:async()=>[{start:'2026-11-14T00:00:00Z',end:'2026-11-18T00:00:00Z'}]};
 assert.deepEqual((await loadMeetingSlotSuggestions({...options,repo})).slots,[]);
});
test('a long but valid duration is fully covered and the search stays under the server seven-day limit',async()=>{
 let range;const repo={meetingAvailability:async(_project,a,b)=>{range=[a,b];return [];}};
 const {slots}=await loadMeetingSlotSuggestions({...options,durationMinutes:720,repo});
 assert.ok(Date.parse(range[1])-Date.parse(range[0])<7*86400000);
 assert.equal(Date.parse(slots[0].end)-Date.parse(slots[0].start),720*60000);
});
