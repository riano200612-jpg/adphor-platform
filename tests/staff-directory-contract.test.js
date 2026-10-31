import test from 'node:test';import assert from 'node:assert/strict';import {staffCard,eligibleAssignees,assignmentRequest} from '../src/js/services/staff-directory-contract.js';
const mk=(project_id,area='Mantenimiento')=>({project_id,user_id:'u1',display_name:'Técnico QA',role_label:'Técnico',area,active:true,can_receive_cases:true,private_photo_path:'private/x.png',photo_approved:false});
test('staff not in selected property or inactive is never shown',()=>{
 assert.equal(staffCard(mk('b'),'a'),null);
 assert.equal(staffCard({...mk('a'),active:false},'a'),null);
 assert.equal(staffCard(mk('a'),'a').photoPath,'');
});
test('permission must be the boolean true, never a truthy imported value',()=>{
 for(const permission of ['false','true',1,{},[],null,undefined,false]) {
  const member={...mk('a'),can_receive_cases:permission};
  assert.equal(staffCard(member,'a').canReceiveCases,false);
  assert.deepEqual(eligibleAssignees([member],'a','Mantenimiento'),[]);
 }
});
test('a card from another property cannot construct an assignment',()=>{
 const assignee=staffCard(mk('a'),'a');
 assert.equal(assignee.projectId,'a');
 assert.throws(()=>assignmentRequest({projectId:'b',caseId:'t',assignee,area:'Mantenimiento',reason:'Revisar'}),/no autorizado/);
});
test('assignment rejects forged permission values and missing property context',()=>{
 const card=staffCard(mk('a'),'a');
 for(const assignee of [{...card,canReceiveCases:'true'},{...card,canReceiveCases:1},{...card,projectId:undefined}]) {
  assert.throws(()=>assignmentRequest({projectId:'a',caseId:'t',assignee,area:'Mantenimiento',reason:'Revisar'}),/no autorizado/);
 }
});
test('identifiers must be nonblank strings and reason must be text',()=>{
 for(const id of [' ',{},[],1,null,undefined]) assert.equal(staffCard({...mk('a'),user_id:id},'a'),null);
 const request={projectId:'a',caseId:'t',assignee:staffCard(mk('a'),'a'),area:'Mantenimiento',reason:'Revisar'};
 for(const field of ['projectId','caseId','area','reason']) {
  for(const value of [' ',{},[],1,null,undefined]) assert.throws(()=>assignmentRequest({...request,[field]:value}),/incompleta/);
 }
});
test('assignment requires area match and backend approval',()=>{
 const team=eligibleAssignees([mk('a'),mk('b'),mk('a','Seguridad')],'a','Mantenimiento');
 assert.equal(team.length,1);
 assert.equal(assignmentRequest({projectId:'a',caseId:'t',assignee:team[0],area:'Mantenimiento',reason:'Revisar'}).approval,'backend_required');
 assert.throws(()=>assignmentRequest({projectId:'a',caseId:'t',assignee:team[0],area:'Seguridad',reason:'Revisar'}));
});
