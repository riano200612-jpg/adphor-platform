import test from 'node:test';import assert from 'node:assert/strict';import {assignedProjects,assignedMembers,assignedTickets} from '../src/js/services/assigned-projects.js';
const projects=[{id:'a',name:'A'},{id:'b',name:'B'}],members=[{project_id:'a',user_id:'u1'},{project_id:'b',user_id:'u2'}],cases=[{project_id:'a',id:'t1'},{project_id:'b',id:'t2'}];
test('delegate sees only assigned projects and tenant data',()=>{
 assert.deepEqual(assignedProjects(projects,members,'u1').map(p=>p.id),['a']);
 assert.deepEqual(assignedMembers(members,'u1',projects).map(m=>m.project_id),['a']);
 assert.deepEqual(assignedTickets(cases,'u1',members,projects).map(t=>t.id),['t1']);
 assert.deepEqual(assignedProjects(projects,members,'unknown'),[]);
});
test('no membership means no user-specific data displayed',()=>{
 assert.deepEqual(assignedTickets(cases,'',members,projects),[]);
 assert.deepEqual(assignedProjects(projects,[], 'u1'),[]);
});
