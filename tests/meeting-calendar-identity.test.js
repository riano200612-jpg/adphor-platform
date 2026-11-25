import test from 'node:test';
import assert from 'node:assert/strict';
import {dedupeCalendarMeetingRows} from '../src/js/services/meeting-calendar-identity.js';

const projectId='source-28';
const id='0123456789abcdef0123456789abcdef';
const key='a'.repeat(64);
const another='1123456789abcdef0123456789abcdef';
const date='2026-12-01T15:00:00.000Z';
const google={projectId,googleEventId:id,idempotencyKey:key,status:'created',meetLink:'https://meet.google.com/abc-defg-hij',
 summary:'Consejo ordinario',start:date};
const historical={projectId,id:'00000000-0000-4000-8000-000000000028',title:'Consejo ordinario',start:date,status:'confirmed'};

test('deduplicates two trusted representations with the same request key',()=>{
 const second={...historical,idempotencyKey:key};
 const rows=dedupeCalendarMeetingRows([google,second],projectId);
 assert.equal(rows.length,1);
 assert.equal(rows[0].googleEventId,id);
 assert.equal(rows[0].title,google.summary);
});

test('deduplicates across an explicit third-party bridge irrespective of input order',()=>{
 const one={...google,idempotencyKey:undefined};
 const two={...historical,idempotencyKey:key};
 const bridge={projectId,idempotencyKey:key,googleEventId:id,status:'created'};
 for(const list of [[one,two,bridge],[bridge,two,one]]){
  const rows=dedupeCalendarMeetingRows(list,projectId);
  assert.equal(rows.length,1);
  assert.equal(rows[0].googleEventId,id);
 }
});

test('retains separate meetings despite matching title, building, and time',()=>{
 const rows=dedupeCalendarMeetingRows([google,historical],projectId);
 assert.equal(rows.length,2);
 assert.ok(rows.some(row=>row.id===historical.id));
});

test('does not interpret a legacy source ID as a Google provider identity',()=>{
 const rows=dedupeCalendarMeetingRows([google,{...historical,source_id:id}],projectId);
 assert.equal(rows.length,2);
});

test('keeps two conflicting Google IDs even with the same request key',()=>{
 const rows=dedupeCalendarMeetingRows([google,{...google,googleEventId:another,status:'created'}],projectId);
 assert.equal(rows.length,2);
});

test('ignores a foreign property before resolving identities',()=>{
 const rows=dedupeCalendarMeetingRows([google,{...historical,projectId:'source-29',idempotencyKey:key}],projectId);
 assert.equal(rows.length,1);
 assert.equal(rows[0].projectId,projectId);
});

test('prefers verified confirmation over a reconciliating representation with same explicit identity',()=>{
 const rows=dedupeCalendarMeetingRows([
 {...google,status:'reconciling',meetLink:null},
 {...historical,idempotencyKey:key},
 ],projectId);
 assert.equal(rows.length,1);
 assert.equal(rows[0].status,'confirmed');
});

test('does not drop a failed record without a proven equivalent',()=>{
 const rows=dedupeCalendarMeetingRows([{...google,status:'failed',googleEventId:null}],projectId);
 assert.equal(rows.length,1);
 assert.equal(rows[0].status,'failed');
});
