import test from 'node:test';
import assert from 'node:assert/strict';
import {REQUIRED_LEGACY_FILES,inspectLegacyInventory,migrationReady} from '../src/js/services/legacy-inventory.js';
test('inventario de origen incluye exactamente 32 fuentes',()=> {
 const paths=Object.entries(REQUIRED_LEGACY_FILES).flatMap(([folder,files])=>files.map(x=>folder+'/'+x));
 assert.equal(paths.length,32);
 const result=inspectLegacyInventory(paths);
 assert.equal(result.complete,true); assert.equal(result.found,32);
});
test('un solo archivo faltante bloquea la migración',()=> {
 const paths=Object.entries(REQUIRED_LEGACY_FILES).flatMap(([folder,files])=>files.map(x=>folder+'/'+x)).slice(1);
 const result=inspectLegacyInventory(paths);
 assert.equal(result.complete,false);assert.equal(result.missing.length,1);
});
test('ningún control de seguridad puede quedar implícitamente aprobado',()=>{
 assert.equal(migrationReady({inventoryComplete:true}),false);
 assert.equal(migrationReady({inventoryComplete:true,secretsReviewed:true,tenantIsolationTested:true,authenticationTested:true,backupVerified:true,browserE2ePassed:true}),true);
});
