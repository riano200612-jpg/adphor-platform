import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {UNIFIED_MODULES,unifiedModuleStatus} from '../src/js/ui-unified-hub.js';
import {pqrsPortalRoute} from '../src/js/ui-pqrs-unified.js';
import {staffForProject,photoForStaff} from '../src/js/ui-client-source-review.js';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const portal='https://script.google.com/macros/s/AKfycbxw64JyydOaye-GksILdtYO4KvshS3OrNW6lXAKmq_Q/exec';

test('regression gate: modern navigation and PQRS recovery cannot be silently replaced by historical-only screen',()=>{
 const app=read('src/js/app.js');
 const pqrs=read('src/js/ui-pqrs-unified.js');
 assert.match(app,/mountUnifiedPqrs\(\$\('page-content'\)/);
 assert.match(app,/Equipo, fotos y datos reales/);
 assert.match(app,/mountMeetingAssessment/);
 assert.match(app,/mountMissAdphorChat/);
 assert.match(pqrs,/Propietarios · Radicar PQRS/);
 assert.match(pqrs,/Consultar radicado/);
 assert.match(pqrs,/Empleados · Portal y PQRS/);
 assert.match(pqrs,/Abrir formulario de radicación y evidencias/);
 assert.match(pqrs,/Falta vincular el enlace \/exec/);
 assert.equal(pqrs.includes('mountPqrsSourceStatus'),false);
 assert.ok(UNIFIED_MODULES.some(x=>x.id==='pqrs'));
 assert.match(unifiedModuleStatus({mode:'cloud',portoEnabled:false}).find(x=>x.id==='pqrs').note,/sin enlace no hay radicación/i);
});
test('regression gate: original portal routes are exact and never pretend to send',()=>{
 assert.equal(pqrsPortalRoute(portal,'owners'),portal+'?page=form');
 assert.equal(pqrsPortalRoute(portal,'tracking'),portal+'?page=status');
 assert.equal(pqrsPortalRoute(portal,'staff'),portal+'?page=portal-team');
 assert.throws(()=>pqrsPortalRoute(portal,'unknown'));
});
test('regression gate: staff gallery must be reached only through cloud administrator navigation and matched to project IDs',()=>{
 const app=read('src/js/app.js');
 const hub=read('src/js/ui-unified-hub.js');
 const source=read('src/js/ui-client-source-review.js');
 assert.match(app,/repo.mode === 'cloud' && role\(\)==='admin'/);
 assert.match(hub,/mode==='cloud'&&role==='admin'/);
 assert.match(hub,/Ver carrusel real:/);
 assert.match(source,/root.classList.add\('source-review'\)/);
 const project={ID_Delegado:12,ID_Coordinador:20};
 const people=[{ID_Delegado:12,Delegado:'María Pérez'},{ID_Delegado:99,Delegado:'Otro'}];
 assert.deepEqual(staffForProject(project,people).map(x=>x.ID_Delegado),[12]);
 assert.equal(photoForStaff({Delegado:'María Pérez'},[{name:'media/fotosColaboradores/1. Maria Perez.jpg'}])?.name,'media/fotosColaboradores/1. Maria Perez.jpg');
 assert.equal(photoForStaff({Delegado:'Otra'},[{name:'media/fotosColaboradores/1. Maria Perez.jpg'}]),null);
});
