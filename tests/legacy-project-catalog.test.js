import test from 'node:test';import assert from 'node:assert/strict';
import {projectCatalogCandidates} from '../src/js/services/legacy-project-catalog.js';
test('imports only approved property identifiers and never leaks private fields',()=>{
 const r=projectCatalogCandidates([
 ['e','Copropiedad','ID_Delegado','Delegado','Correo Electrónico','Foto','Sector'],
 ['OLD1','Porto Castello','7','Nombre reservado','private@example.test','private-image','Norte'],
 ['OLD2','Sin mapear','8','Otra persona','other@example.test','private2','Sur']
 ],{approvedProjectMap:{OLD1:'qa-porto'}});
 assert.equal(r.projects.length,1);assert.equal(r.rejected.length,1);
 assert.deepEqual(r.projects[0],{id:'qa-porto',name:'Porto Castello',sector:'Norte',source:'jose_master',migration_status:'candidate',requires_server_approval:true});
 const payload=JSON.stringify(r);for(const x of ['private@example.test','private-image','Nombre reservado','7'])assert.ok(!payload.includes(x));
});
test('rejects unapproved mapping, duplicate projects, missing required headers',()=>{
 assert.equal(projectCatalogCandidates([['Copropiedad'],['Otro']]).projects.length,0);
 assert.equal(projectCatalogCandidates([['Copropiedad'],['A'],['A']],{approvedProjectMap:{A:'project-a'}}).rejected.length,1);
 assert.throws(()=>projectCatalogCandidates([['Delegado'],['A']]));
});
