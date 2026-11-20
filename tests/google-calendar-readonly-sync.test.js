import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeGoogleSourceEvent,readGoogleSourceWindow,planSourceMirrorDelta} from '../src/js/services/google-calendar-readonly-sync.js';
const cal='corporativo@example.org',min='2026-11-01T00:00:00-05:00',max='2026-12-01T00:00:00-05:00';
const e=(id='a')=>({id,summary:'Consejo ADPHOR',status:'confirmed',start:{dateTime:'2026-11-20T09:00:00-05:00'},end:{dateTime:'2026-11-20T10:00:00-05:00'},attendees:[{email:'private@invalid'}],description:'Dato confidencial'});
const reqFor=(json)=>async(url,options)=>{
 const u=new URL(url);
 assert.equal(u.origin,'https://www.googleapis.com');
 assert.equal(u.pathname,'/calendar/v3/calendars/corporativo%40example.org/events');
 assert.equal(options.method,'GET');
 assert.ok(!url.includes('secret')&&!url.includes('token-value'));
 assert.equal(options.headers.Authorization,'Bearer token-value');
 assert.equal(u.searchParams.get('singleEvents'),'true');
 assert.equal(u.searchParams.get('showDeleted'),'true');
 assert.ok(u.searchParams.get('fields').includes('summary'));
 assert.equal(u.searchParams.get('timeZone'),'America/Bogota');
 return {ok:true,json:async()=>json};
};
test('Google read-only adapter uses GET with OAuth only in Authorization and removes private fields',async()=>{
 const s=await readGoogleSourceWindow({calendarId:cal,accessToken:'token-value',timeMin:min,timeMax:max,request:reqFor({items:[e()]})});
 assert.equal(s.events.length,1);
 assert.deepEqual(s.events[0],{id:'a',status:'confirmed',summary:'Consejo ADPHOR',start:'2026-11-20T14:00:00.000Z',end:'2026-11-20T15:00:00.000Z'});
 assert.ok(!JSON.stringify(s).includes('private@invalid'));
 assert.ok(!JSON.stringify(s).includes('Dato confidencial'));
});
test('pagination must finish and must not duplicate records',async()=>{
 let requests=0;
 const request=async(url)=>{requests++;const u=new URL(url);return {ok:true,json:async()=>requests===1?{items:[e('a')],nextPageToken:'p2'}:{items:[e('b')]}}};
 const s=await readGoogleSourceWindow({calendarId:cal,accessToken:'access',timeMin:min,timeMax:max,request});
 assert.equal(s.pages,2);assert.equal(s.events.length,2);
 assert.equal(requests,2);
 await assert.rejects(readGoogleSourceWindow({calendarId:cal,accessToken:'access',timeMin:min,timeMax:max,
  request:async()=>({ok:true,json:async()=>({items:[e('a')],nextPageToken:'again'})}),maxPages:2}),/duplicado|incompleto/);
});
test('cancelled recurring exception is a review marker; all-day exclusive boundary is maintained',()=>{
 assert.deepEqual(normalizeGoogleSourceEvent({id:'cancelled',status:'cancelled'}),{id:'cancelled',status:'cancelled',needsReview:true});
 const d=normalizeGoogleSourceEvent({id:'day',start:{date:'2026-11-22'},end:{date:'2026-11-23'}});
 assert.equal(d.start,'2026-11-22T05:00:00.000Z');assert.equal(d.end,'2026-11-23T05:00:00.000Z');
});
test('incomplete, failed or expired provider data fails closed without applying changes',async()=>{
 for(const response of [{ok:false,status:410},{ok:false,status:403},{ok:true,json:async()=>({wrong:[]})}]){
  await assert.rejects(readGoogleSourceWindow({calendarId:cal,accessToken:'auth',timeMin:min,timeMax:max,request:async()=>response}));
 }
 for(const item of [{id:'x',status:'confirmed'}, {...e(),start:{dateTime:'2026-11-31T09:00:00-05:00'}},
  {...e(),status:'declined'},{...e(),end:{dateTime:'2026-11-20T08:00:00-05:00'}}])
  assert.throws(()=>normalizeGoogleSourceEvent(item));
});
test('snapshot diff separates changed, new, cancelled and absent without deleting or approving tenant mappings',()=>{
 const snap={calendarId:cal,timeMin:min,timeMax:max,events:[
  normalizeGoogleSourceEvent(e('unchanged')),normalizeGoogleSourceEvent({...e('changed'),summary:'Cambio'}),
  normalizeGoogleSourceEvent(e('new')),normalizeGoogleSourceEvent({id:'cancelled',status:'cancelled'})
 ]};
 const record=(id,summary='Consejo ADPHOR')=>({calendar_id:cal,google_event_id:id,summary,start_at:'2026-11-20T14:00:00Z',end_at:'2026-11-20T15:00:00Z',source_status:'confirmed',mapped_project_id:null,mapping_reviewed:false});
 const d=planSourceMirrorDelta(snap,[record('unchanged'),record('changed'),record('gone')]);
 assert.equal(d.unchangedCount,1);
 assert.deepEqual(d.toInsert.map(x=>x.id),['new']);
 assert.deepEqual(d.toUpdate.map(x=>x.id),['changed']);
 assert.deepEqual(d.cancelledForReview,['cancelled']);
 assert.deepEqual(d.notReturnedForReview,['gone']);
 assert.ok(!('toDelete' in d)&&!('mappingReviewed' in d));
});
test('cross-calendar mirror, duplicate ids, forged timestamps and incomplete snapshots fail closed',()=>{
 const snap={calendarId:cal,timeMin:min,timeMax:max,events:[normalizeGoogleSourceEvent(e())]};
 const old={calendar_id:'other',google_event_id:'a',summary:'Consejo ADPHOR',start_at:'2026-11-20T14:00:00Z',end_at:'2026-11-20T15:00:00Z',source_status:'confirmed'};
 assert.throws(()=>planSourceMirrorDelta(snap,[old]),/ajeno/);
 assert.throws(()=>planSourceMirrorDelta({...snap,events:[snap.events[0],snap.events[0]]},[]),/Duplicados/);
 assert.throws(()=>planSourceMirrorDelta({...snap,timeMax:'2026-11-01T00:00:00-05:00'},[]),/Ventana/);
 assert.throws(()=>planSourceMirrorDelta({...snap,events:[{...snap.events[0],start:'2026-11-20T14:00:00'}]},[]));
});
test('bounded source windows and explicit tokens prevent credential misuse',async()=>{
 const request=async()=>{throw Error('Never call provider');};
 for(const patch of [{accessToken:'bad token'}, {timeMin:'2026-11-01T00:00:00'}, {timeMax:'2027-11-01T00:00:00-05:00'}, {calendarId:'https://evil.invalid'}]){
  await assert.rejects(readGoogleSourceWindow({calendarId:cal,accessToken:'ok',timeMin:min,timeMax:max,request,...patch}));
 }
});
