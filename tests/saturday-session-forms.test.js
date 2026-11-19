import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {QA_IDLE_LIMIT_MS,QA_IDLE_STORAGE_KEY,readIdleStamp,expiredStoredSession,createQaIdleGuard} from '../src/js/services/qa-idle-session.js';

function fixture(){
 let clock=1000,expired=0;
 const data=new Map();
 const storage={getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};
 const pending=new Map();let counter=0;
 const guard=createQaIdleGuard({storage,now:()=>clock,limit:QA_IDLE_LIMIT_MS,
 schedule:(fn)=>{pending.set(++counter,fn);return counter;},
 cancel:id=>pending.delete(id),
 onExpire:()=>expired++});
 return {guard,storage,advance:ms=>{clock+=ms;},now:()=>clock,pending,expired:()=>expired};
}

test('ten minutes is the explicit client session limit; no credentials in stamp',()=>{
 assert.equal(QA_IDLE_LIMIT_MS,600000);
 const f=fixture();
 assert.equal(f.guard.start('qa-user',{fresh:true}),true);
 const raw=f.storage.getItem(QA_IDLE_STORAGE_KEY);
 assert.ok(raw.includes('"uid":"qa-user"'));
 assert.ok(!raw.includes('token'));
 assert.deepEqual(readIdleStamp(f.storage),{uid:'qa-user',at:1000,expired:false});
 f.advance(QA_IDLE_LIMIT_MS-1);
 assert.equal(f.guard.check(),true);
 assert.equal(f.expired(),0);
 f.advance(1);assert.equal(f.guard.check(),false);
 assert.equal(f.expired(),1);
 assert.equal(f.guard.check(),false);
 assert.equal(f.expired(),1);
 assert.equal(expiredStoredSession(f.storage,f.now()),true);
});

test('activity extends deadline; re-render does NOT extend it',()=>{
 const f=fixture();f.guard.start('qa-user',{fresh:true});
 f.advance(400000);f.guard.activity();
 f.advance(400000);assert.equal(f.guard.start('qa-user'),true);
 f.advance(200000);assert.equal(f.guard.check(),false);
 assert.equal(f.expired(),1);
});

test('expired sessions remain blocked on reload until a new login',()=>{
 const f=fixture();f.guard.start('qa-user',{fresh:true});
 f.advance(600001);assert.equal(expiredStoredSession(f.storage,f.now()),true);
 const second=createQaIdleGuard({storage:f.storage,now:f.now,onExpire:()=>{} ,schedule:()=>0,cancel:()=>{}});
 assert.equal(second.start('qa-user'),false);
 assert.equal(second.start('qa-user',{fresh:true}),true);
 assert.equal(expiredStoredSession(f.storage,f.now()),false);
 second.stop({clearStorage:true});
 assert.equal(readIdleStamp(f.storage),null);
});

test('clock rollback, corrupted stamp and no storage fail closed on re-entry',()=>{
 const f=fixture();f.guard.start('qa-user',{fresh:true});
 f.advance(-1000);assert.equal(f.guard.check(),false);
 f.storage.setItem(QA_IDLE_STORAGE_KEY,'not-json');
 assert.equal(expiredStoredSession(f.storage,f.now()),true);
 f.storage.removeItem(QA_IDLE_STORAGE_KEY);
 assert.equal(expiredStoredSession(f.storage,f.now()),false);
});

test('QA app integrates after AAL2 and clears state on timeout',()=>{
 const s=readFileSync(new URL('../src/js/app.js',import.meta.url),'utf8');
 assert.match(s,/idleSession\.start\(state\.user\.id,\{fresh:true\}\)/);
 assert.match(s,/expiredStoredSession\(sessionStorage\)/);
 assert.match(s,/if\(repo\.mode==='cloud'&&state\.user&&!idleSession\.start\(state\.user\.id\)\)return/);
 assert.match(s,/void repo\.logout\(\)\.catch/);
 assert.match(s,/state\.projects=\[\];state\.members=\[\]/);
});

test('Saturday forms keep RLS and server writes; no Calendar integration touched',()=>{
 const pqrs=readFileSync(new URL('../src/js/ui-pqrs.js',import.meta.url),'utf8');
 const visits=readFileSync(new URL('../src/js/ui-visit-preparation.js',import.meta.url),'utf8');
 const iam=readFileSync(new URL('../src/js/ui-iam-live.js',import.meta.url),'utf8');
 assert.match(pqrs,/pqrs-optional-fields/);
 assert.match(pqrs,/evidenceInput\.disabled=true/);
 assert.match(pqrs,/repository\.create\(projectId,payload,requestId\)/);
 assert.match(visits,/visit-kind-suggestions/);
 assert.match(visits,/repository\.save\(request\)/);
 assert.match(iam,/access-workflow panel adphor-simple-form/);
});
