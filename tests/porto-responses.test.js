import test from 'node:test';
import assert from 'node:assert/strict';
import {createPortoRepository} from '../src/js/services/porto.js';
const ref='abcdefghijklmnopqrst';
const settings={url:`https://${ref}.supabase.co`,enabled:'true',stagingRef:ref};
function fixture({rows=[],caseVisible=true,membership=true}={}){
 const calls=[];
 const client={
  auth:{getUser:async()=>({data:{user:{id:'actor-qa'}}})},
  from(table){
   calls.push(table);
   if(table==='memberships')return {
    select(){return this},eq(){return this},limit(){return {data:membership?[{project_id:'p1'}]:[],error:null}}
   };
   if(table==='pilot_pqrs')return {
    select(){return this},eq(){return this},
    single(){return caseVisible?{data:{id:'case-1'},error:null}:{data:null,error:{message:'not found'}}}
   };
   assert.equal(table,'pilot_pqrs_responses');
   const query={
    select(fields){assert.equal(fields,'id,case_id,body,created_at');return this},
    eq(key,value){assert.equal(key,'case_id');assert.equal(value,'case-1');return this},
    order(key,opts){assert.ok(['created_at','id'].includes(key));assert.equal(opts.ascending,true);return this},
    limit(size){assert.equal(size,201);return {data:rows,error:null}}
   };
   return query;
  }
 };
 return {repo:createPortoRepository(client,settings),calls};
}
test('PQRS responses are scoped, chronological, and never projected with unneeded private columns',async()=>{
 const rows=[{id:'r1',case_id:'case-1',body:'Respuesta QA',created_at:'2026-11-13T15:00:00Z'}];
 const x=fixture({rows});
 assert.deepEqual(await x.repo.responses('p1','case-1'),rows);
 assert.deepEqual(x.calls,['memberships','pilot_pqrs','pilot_pqrs_responses']);
});
test('PQRS response reading stops without membership or a case in the selected property',async()=>{
 const one=fixture({membership:false});
 await assert.rejects(one.repo.responses('p2','case-1'),/no autorizado/);
 assert.deepEqual(one.calls,['memberships']);
 const two=fixture({caseVisible:false});
 await assert.rejects(two.repo.responses('p1','case-1'),/not found/);
 assert.deepEqual(two.calls,['memberships','pilot_pqrs']);
});
test('PQRS response history rejects truncated or cross-case results',async()=>{
 await assert.rejects(fixture({rows:Array.from({length:201},(_,i)=>({id:String(i),case_id:'case-1'}))}).repo.responses('p1','case-1'),/incompleto/);
 await assert.rejects(fixture({rows:[{id:'r',case_id:'case-2',body:'foreign'}]}).repo.responses('p1','case-1'),/incompleto/);
});
