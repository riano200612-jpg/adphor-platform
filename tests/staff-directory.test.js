import test from 'node:test';
import assert from 'node:assert/strict';
import {createStaffDirectory} from '../src/js/services/staff-directory.js';

function fixture({aal='aal2',member=true}={}){
 const calls=[];
 const client={auth:{mfa:{getAuthenticatorAssuranceLevel:async()=>({data:{currentLevel:aal}})},getUser:async()=>({data:{user:{id:'qa-a'}}})},
 from:table=>{calls.push(table);const query={select:()=>query,eq:(key,value)=>{calls.push([key,value]);return query;},limit:async()=>({data:member?[{project_id:'a'}]:[]}),order:async()=>({data:[{id:'delegate-1',project_id:'a',name:'Persona sintética',photo_path:null}]})};return query;}};
 return {calls,repository:createStaffDirectory(client)};
}
test('staff reads require AAL2 before any protected request',async()=>{
 const f=fixture({aal:'aal1'});await assert.rejects(f.repository.list('a'),/MFA/);assert.deepEqual(f.calls,[]);
});
test('staff reads require caller membership and retain the exact property filter',async()=>{
 const f=fixture();assert.equal((await f.repository.list('a')).length,1);
 assert.ok(f.calls.some(x=>Array.isArray(x)&&x[0]==='project_id'&&x[1]==='a'));
 assert.ok(f.calls.some(x=>Array.isArray(x)&&x[0]==='user_id'&&x[1]==='qa-a'));
 const denied=fixture({member:false});await assert.rejects(denied.repository.list('b'),/no autorizada/);
 assert.equal(denied.calls.includes('qa_staff_directory'),false);
 await assert.rejects(denied.repository.photo('b','delegate-1'),/no autorizada/);
});
