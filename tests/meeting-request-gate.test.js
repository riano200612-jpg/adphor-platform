import test from 'node:test';
import assert from 'node:assert/strict';
import {createMeetingRequestGate} from '../src/js/services/meeting-request-gate.js';
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
function fixture(){
 let value='p1|date|duration|escort',connected=true;
 const events=[],controls={availability:false,suggestions:false};
 const gate=createMeetingRequestGate({snapshot:()=>value,connected:()=>connected,onBusy:busy=>{
  events.push(busy);controls.availability=busy;controls.suggestions=busy;
 }});
 return {gate,events,controls,change:next=>{value=next;gate.invalidate();},disconnect:()=>{connected=false;}};
}
test('duplicate clicks do not replace the active owner; successful results survive finish until invalidation',()=>{
 const f=fixture(),a=f.gate.begin();
 assert.equal(f.gate.begin(),null);assert.equal(a.isCurrent(),true);
 assert.equal(a.finish(),true);assert.equal(a.finish(),false);assert.equal(a.isCurrent(),true);
 assert.deepEqual(f.events,[true,false]);
 f.change('p1|new-date');assert.equal(a.isCurrent(),false);
});
test('obsolete finally cannot enable either control owned by a newer request',()=>{
 const f=fixture(),a=f.gate.begin();f.change('p1|new-duration');const b=f.gate.begin();
 assert.equal(a.finish(),false);assert.equal(a.isCurrent(),false);assert.equal(b.isCurrent(),true);
 assert.deepEqual(f.controls,{availability:true,suggestions:true});
 b.finish();assert.deepEqual(f.controls,{availability:false,suggestions:false});
});
test('out-of-order responses only publish the latest result',async()=>{
 const f=fixture(),a=f.gate.begin(),da=deferred(),db=deferred(),published=[];
 const perform=async(ticket,operation)=>{try{const result=await operation.promise;if(ticket.isCurrent())published.push(result);}finally{ticket.finish();}};
 const first=perform(a,da);f.change('p1|new-date');const b=f.gate.begin(),second=perform(b,db);
 db.resolve('new');await second;da.resolve('old');await first;
 assert.deepEqual(published,['new']);assert.deepEqual(f.controls,{availability:false,suggestions:false});
});
test('obsolete rejection leaves the replacement busy and does not publish an old error',async()=>{
 const f=fixture(),a=f.gate.begin(),d=deferred(),errors=[];
 const first=(async()=>{try{await d.promise;}catch(error){if(a.isCurrent())errors.push(error.message);}finally{a.finish();}})();
 f.change('p1|new-escort');const b=f.gate.begin();d.reject(Error('old failure'));await first;
 assert.deepEqual(errors,[]);assert.equal(f.controls.availability,true);assert.equal(f.controls.suggestions,true);
 b.finish();
});
test('property context change and detached components cannot publish or mutate controls',()=>{
 const f=fixture(),a=f.gate.begin();f.change('p2|date|duration|escort');const b=f.gate.begin();
 assert.equal(a.isCurrent(),false);assert.equal(b.isCurrent(),true);
 f.disconnect();const count=f.events.length;
 assert.equal(b.isCurrent(),false);b.finish();f.gate.invalidate();
 assert.equal(f.gate.begin(),null);assert.equal(f.events.length,count);
});
test('silent snapshot changes invalidate results even without a DOM input event',()=>{
 let snapshot='old';const gate=createMeetingRequestGate({snapshot:()=>snapshot,connected:()=>true,onBusy:()=>{}});
 const a=gate.begin();snapshot='new';assert.equal(a.isCurrent(),false);a.finish();
});
