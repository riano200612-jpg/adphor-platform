import {test,expect} from '@playwright/test';
const fixture=[
 {username:'j.guzman',display_name:'Persona Operativa QA',legacy_status:'Activo',
  review_classification:'MATCHED',staff_matched:true,auth_linked:false},
 {username:'r.bloqueado',display_name:'Persona Bloqueada QA',legacy_status:'Bloqueado',
  review_classification:'BLOCKED',staff_matched:true,auth_linked:false},
 {username:'d.baja',display_name:'Persona Desactivada QA',legacy_status:'Desactivado',
  review_classification:'DISABLED',staff_matched:true,auth_linked:false},
 {username:'a.revisar',display_name:'Persona No Conciliada QA',legacy_status:'Activo',
  review_classification:'ALIAS_REVIEW',staff_matched:true,auth_linked:false},
 {username:'v.vinculado',display_name:'Persona Vinculada QA',legacy_status:'Activo',
  review_classification:'MATCHED',staff_matched:true,auth_linked:true},
];
async function mount(page,allowed=true){
 await page.goto('./');
 await page.evaluate(async({people,allowed})=>{
  const {mountLiveIamAdmin}=await import('/adphor-platform/src/js/ui-iam-live.js');
  const root=document.createElement('main');root.id='iam-legacy-test';
  document.body.replaceChildren(root);
  window.__legacyCommands=0;
  const iam={
   read:async()=>{if(!allowed)throw Error('MFA AAL2 missing');return{
    enabled:true,accounts:[],audit:[],
    legacy_review:{total:people.length,candidates:people}
   };},
   command:async()=>{window.__legacyCommands++;throw Error('No account changes in this test');}
  };
  await mountLiveIamAdmin(root,{iam,projects:[{id:'qa-a',name:'Edificio sintético QA'}]});
 },{people:fixture,allowed});
}
test('historical onboarding preselects ONLY name and wipes stale invitation credentials and grants',async({page})=>{
 await mount(page);
 const invite=page.locator('form.access-workflow').first();
 await invite.locator('input[type=text]').fill('Otro Empleado');
 await invite.locator('input[type=email]').fill('wrong@example.invalid');
 await invite.locator('select').first().selectOption('qa-a');
 await invite.locator('select').last().selectOption('admin');
 await invite.locator('textarea').fill('Otro permiso aprobado');
 await page.getByRole('button',{name:'Preseleccionar j.guzman para invitación'}).click();
 await expect(invite.locator('input[type=text]')).toHaveValue('Persona Operativa QA');
 await expect(invite.locator('input[type=email]')).toHaveValue('');
 await expect(invite.locator('select').first()).toHaveValue('');
 await expect(invite.locator('select').last()).toHaveValue('viewer');
 await expect(invite.locator('textarea')).toHaveValue('');
 await expect(page.getByRole('status')).toContainText('Alias aún no vinculado para iniciar sesión');
 expect(await page.evaluate(()=>window.__legacyCommands)).toBe(0);
});
test('blocked, deactivated, linked and ambiguous legacy staff never expose a preparation button',async({page})=>{
 await mount(page);
 await expect(page.getByRole('button',{name:/Preseleccionar .* para invitación/})).toHaveCount(1);
 await expect(page.getByRole('button',{name:'Preseleccionar j.guzman para invitación'})).toBeVisible();
 for(const label of ['Bloqueado en la fuente original','Desactivado en la fuente original',
   'Requiere conciliación de identidad y personal','Cuenta vinculada o estado de acceso desconocido']){
  await expect(page.getByText(label,{exact:true})).toBeVisible();
 }
});
test('no private candidate inventory without real authorized IAM read',async({page})=>{
 await mount(page,false);
 await expect(page.getByText('Operaciones reales aún no habilitadas en QA o sesión sin autorización general.')).toBeVisible();
 await expect(page.getByText('Persona Operativa QA')).toHaveCount(0);
 await expect(page.getByRole('button',{name:/Preseleccionar/})).toHaveCount(0);
});
