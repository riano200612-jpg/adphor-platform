import test from 'node:test';import assert from 'node:assert/strict';import {staffCard,eligibleAssignees,assignmentRequest} from '../src/js/services/staff-directory-contract.js';
const mk=(project_id,area='Mantenimiento')=>({project_id,user_id:'u1',display_name:'Técnico QA',role_label:'Técnico',area,active:true,can_receive_cases:true,private_photo_path:'private/x.png',photo_approved:false});
test('staff not in selected property or inactive is never shown',()=>{
 assert.equal(staffCard(mk('b'),'a'),null);
 assert.equal(staffCard({...mk('a'),active:false},'a'),null);
 assert.equal(staffCard(mk('a'),'a').photoPath,'');
});
test('assignment requires area match and backend approval',()=>{
 const team=eligibleAssignees([mk('a'),mk('b'),mk('a','Seguridad')],'a','Mantenimiento');
 assert.equal(team.length,1);
 assert.equal(assignmentRequest({projectId:'a',caseId:'t',assignee:team[0],area:'Mantenimiento',reason:'Revisar'}).approval,'backend_required');
 assert.throws(()=>assignmentRequest({projectId:'a',caseId:'t',assignee:team[0],area:'Seguridad',reason:'Revisar'}));
});
