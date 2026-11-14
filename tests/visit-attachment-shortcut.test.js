import test from 'node:test';
import assert from 'node:assert/strict';
import {canAttachVisitEvidence} from '../src/js/ui-visit-lifecycle.js';

const evidence={
 uploadEvidence:async()=>[],listEvidence:async()=>[],signedEvidence:async()=>''
};
const repo={evidence};
test('acceso directo de adjuntos solo para visitas activas con escritura y proveedor completo',()=>{
 for(const status of ['programada','en_ejecucion'])
  assert.equal(canAttachVisitEvidence({status},repo,true),true,status);
 for(const status of ['completada','cancelada','desconocida'])
  assert.equal(canAttachVisitEvidence({status},repo,true),false,status);
 assert.equal(canAttachVisitEvidence({status:'programada'},repo,false),false);
 assert.equal(canAttachVisitEvidence({status:'programada'},{},true),false);
 assert.equal(canAttachVisitEvidence({status:'programada'},{evidence:{uploadEvidence(){}}},true),false);
});
