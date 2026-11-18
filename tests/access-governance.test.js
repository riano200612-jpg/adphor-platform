import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {visibleAccessInventory,filterAccessInventory,prepareAccessDraft,PROPERTY_ROLES,ACCESS_STEPS} from '../src/js/services/access-governance.js';
const projects=[{id:'a',name:'Edificio Alfa'},{id:'b',name:'Edificio Beta'}];
const memberships=[
 {user_id:'u1',name:'Persona Uno',project_id:'a',role:'admin'},
 {user_id:'u1',name:'Persona Uno',project_id:'b',role:'coordinator'},
 {user_id:'u1',name:'Persona Uno',project_id:'b',role:'coordinator'},
 {user_id:'u2',name:'Persona Dos',project_id:'a',role:'viewer'}
];
test('inventario usa exclusivamente membresías visibles; no simula cuentas Auth',()=>{
 const users=visibleAccessInventory(memberships,projects);
 assert.equal(users.length,2);
 assert.equal(users.find(u=>u.id==='u1').assignmentCount,2);
 assert.deepEqual(users.find(u=>u.id==='u1').roles,['admin','coordinator']);
 assert.equal(users[0].accountStatus,'No verificado');
 assert.equal(visibleAccessInventory([],projects).length,0);
 assert.equal(visibleAccessInventory([{user_id:null,project_id:'a'}],projects).length,0);
});
test('filtro local no amplía tenencia ni permisos',()=>{
 const users=visibleAccessInventory(memberships,projects);
 assert.equal(filterAccessInventory(users,'beta').length,1);
 assert.equal(filterAccessInventory(users,'desconocido').length,0);
});
test('invitaciones son borradores sin escalada a admin general',()=>{
 const good=prepareAccessDraft({kind:'invite',email:' Nuevo@ejemplo.co ',projectId:'a',role:'viewer'},[],projects);
 assert.match(good,/NO EJECUTADO/);assert.match(good,/nuevo@ejemplo.co/);
 assert.match(good,/MFA AAL2/);
 for(const role of ['technical_admin','general_admin','owner','service_role'])assert.throws(
 ()=>prepareAccessDraft({kind:'invite',email:'a@ejemplo.co',projectId:'a',role},[],projects),/rol/);
 assert.throws(()=>prepareAccessDraft({kind:'invite',email:'a@ejemplo.co',projectId:'desconocido',role:'admin'},[],projects),/copropiedad/);
 assert.throws(()=>prepareAccessDraft({kind:'invite',email:'malo',projectId:'a',role:'viewer'},[],projects),/correo/);
 assert.equal(PROPERTY_ROLES.admin,'Administrador de copropiedad');
});
test('baja exige usuario visible, motivo y pasos contra persistencia de sesiones',()=>{
 const users=visibleAccessInventory(memberships,projects);
 const draft=prepareAccessDraft({kind:'offboard',targetId:'u1',reason:'Retiro laboral confirmado'},users,projects);
 assert.match(draft,/NO EJECUTADO/);assert.match(draft,/refresh tokens/);
 assert.match(draft,/último administrador general/);
 assert.match(draft,/no se ha desactivado ninguna cuenta/i);
 assert.throws(()=>prepareAccessDraft({kind:'offboard',targetId:'otro',reason:'Retiro laboral confirmado'},users,projects),/identidad visible/);
 assert.throws(()=>prepareAccessDraft({kind:'offboard',targetId:'u1',reason:'baja'},users,projects),/motivo/);
 assert.ok(ACCESS_STEPS.offboard.length>=6);
});
test('UI no invoca APIs administrativas ni envía formularios de cambios',()=>{
 const ui=readFileSync(new URL('../src/js/ui-access-management.js',import.meta.url),'utf8');
 const app=readFileSync(new URL('../src/js/app.js',import.meta.url),'utf8');
 assert.ok(app.includes('mountAccessManagement'));
 assert.ok(ui.includes('preventDefault()'));
 assert.ok(ui.includes('textContent'));
 for(const forbidden of ['auth.admin','service_role','inviteUserByEmail','deleteUser(','updateUserById(','fetch(','\.rpc('])
   assert.equal(ui.includes(forbidden),false,forbidden);
});
