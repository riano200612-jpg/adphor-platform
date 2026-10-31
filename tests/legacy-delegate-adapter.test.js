import test from 'node:test';import assert from 'node:assert/strict';import {prepareDelegateAssignments} from '../src/js/services/legacy-delegate-adapter.js';
test('maps only active authorized delegations without leaking private columns',()=>{
 const result=prepareDelegateAssignments({
  delegates:[{ID_Delegado:'7',Estado:'Activo',Rol:'delegado',PIN:'SECRET',Correo:'private@example.test',Foto:'private.jpg'},{ID_Delegado:'8',Estado:'Bloqueado',PIN:'SECRET2'}],
  properties:[{ID_Copropiedad:'property-01',ID_Delegado:'7', 'Correo Electrónico':'private2@example.test'},{ID_Copropiedad:'property-02',ID_Delegado:'8'}],
  userIdByLegacyId:{'7':'auth-qa-7','8':'auth-qa-8'}
 });
 assert.equal(result.assignments.length,1);
 assert.equal(result.rejected.length,1);
 assert.equal(result.assignments[0].requires_project_id_mapping,true);
 const resultText=JSON.stringify(result);
 for(const v of ['SECRET','private@example.test','private.jpg','private2@example.test']) assert.equal(resultText.includes(v),false);
});
test('no identity mapping means no delegated access',()=>{
 const x=prepareDelegateAssignments({delegates:[{ID_Delegado:'1',Estado:'Activo'}],properties:[{ID_Copropiedad:'P',ID_Delegado:'1'}]});
 assert.deepEqual(x.assignments,[]);
});
