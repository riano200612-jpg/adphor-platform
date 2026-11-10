import test from 'node:test';import assert from 'node:assert/strict';
import {createPortoRepository} from '../src/js/services/porto.js';
const ref='abcdefghijklmnopqrst';
const config={url:'https://'+ref+'.supabase.co',enabled:'true',stagingRef:ref};
test('PQRS never queries a project without current membership',async()=>{
 let casesQueried=false;
 const client={auth:{getUser:async()=>({data:{user:{id:'qa-user'}}})},
 from(name){if(name==='pilot_pqrs'){casesQueried=true;throw Error('unexpected');}
 assert.equal(name,'memberships');
 return {select(){return this},eq(){return this},limit(){return Promise.resolve({data:[]})}};}};
 const repository=createPortoRepository(client,config);
 await assert.rejects(repository.list('other-project'),/no autorizado/);
 await assert.rejects(repository.listAttention('other-project'),/no autorizado/);
 assert.equal(casesQueried,false);
 await assert.rejects(repository.create('other-project',{kind:'queja',subject:'x',description:'y'},'req'),/no autorizado/);
 assert.equal(casesQueried,false);
});
test('PQRS rejects blank project before accessing records',async()=>{
 const client={auth:{getUser:async()=>({data:{user:{id:'qa-user'}}})},from(){throw Error('No database query should occur')}};
 await assert.rejects(createPortoRepository(client,config).list(''),/Copropiedad inválida/);
});

test('Atención hoy reads all authorized PQRS beyond the first 200',async()=>{
 const project='qa-project';
 const rows=Array.from({length:405},(_,i)=>({id:String(i).padStart(3,'0'),project_id:project,status:'open'}));
 const cursors=[];
 const client={auth:{getUser:async()=>({data:{user:{id:'qa-user'}}})},from(name){
  if(name==='memberships')return {select(){return this},eq(){return this},limit(){return {data:[{project_id:project}]}}};
  assert.equal(name,'pilot_pqrs');
  let cursor='';
  return {
   select(){return this},
   eq(field,value){assert.equal(field,'project_id');assert.equal(value,project);return this},
   in(field,values){assert.equal(field,'status');assert.deepEqual(values,['open','assigned','in_progress']);return this},
   order(field,options){assert.equal(field,'id');assert.equal(options.ascending,true);return this},
   limit(size){assert.equal(size,200);return this},
   gt(field,value){assert.equal(field,'id');cursor=value;return this},
   then(resolve){cursors.push(cursor);resolve({data:rows.filter(row=>row.id>cursor).slice(0,200)})}
  };
 }};
 const result=await createPortoRepository(client,config).listAttention(project);
 assert.deepEqual(result,rows);
 assert.deepEqual(cursors,['','199','399','404']);
});
