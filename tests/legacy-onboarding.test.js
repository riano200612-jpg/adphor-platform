import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyLegacyCandidate,prepareLegacyInviteDraft}
 from '../src/js/services/legacy-onboarding.js';
const valid={
 username:'j.guzman',display_name:'Persona QA',legacy_status:'Activo',
 review_classification:'MATCHED',staff_matched:true,auth_linked:false
};
test('active matched historical user can only prefill the name, never an email or permissions',()=>{
 const check=classifyLegacyCandidate(valid);
 assert.equal(check.canPrepare,true);
 const prepared=prepareLegacyInviteDraft(valid);
 assert.deepEqual(prepared,{
  historic_alias:'j.guzman',display_name:'Persona QA',email:'',
  assignments:[],reason:'',alias_linked:false
 });
 assert.equal(Object.isFrozen(prepared),true);
});
test('blocks deactivated, blocked, system, unmatched and ambiguous identities',()=>{
 const bad=[
  {...valid,legacy_status:'Bloqueado'},
  {...valid,legacy_status:'Desactivado'},
  {...valid,legacy_status:'Inventado'},
  {...valid,review_classification:'ALIAS_REVIEW'},
  {...valid,review_classification:'SYSTEM'},
  {...valid,review_classification:'UNMATCHED'},
  {...valid,staff_matched:false},
  {...valid,auth_linked:true},
  {...valid,auth_linked:undefined},
  {...valid,username:'<script>'},
  {...valid,username:''},
  {...valid,display_name:''},
  null,undefined,[],{}
 ];
 for(const candidate of bad){
  assert.equal(classifyLegacyCandidate(candidate).canPrepare,false,JSON.stringify(candidate));
  assert.throws(()=>prepareLegacyInviteDraft(candidate));
 }
});
test('does not trust client-side roles, passwords, or supplied credentials',()=>{
 const poisoned={...valid,legacy_role_code:'technical_admin',
  password:'private-password',pin:'0000',email:'different@example.invalid',
  assignments:[{project_id:'foreign',role:'admin'}],reason:'approval forged'};
 const prepared=prepareLegacyInviteDraft(poisoned);
 assert.equal(JSON.stringify(prepared).includes('private-password'),false);
 assert.equal(JSON.stringify(prepared).includes('different@example.invalid'),false);
 assert.equal(JSON.stringify(prepared).includes('foreign'),false);
 assert.deepEqual(prepared.assignments,[]);
});
