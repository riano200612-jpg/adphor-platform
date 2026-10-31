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
 assert.equal(casesQueried,false);
 await assert.rejects(repository.create('other-project',{kind:'queja',subject:'x',description:'y'},'req'),/no autorizado/);
 assert.equal(casesQueried,false);
});
test('PQRS rejects blank project before accessing records',async()=>{
 const client={auth:{getUser:async()=>({data:{user:{id:'qa-user'}}})},from(){throw Error('No database query should occur')}};
 await assert.rejects(createPortoRepository(client,config).list(''),/Copropiedad inválida/);
});
