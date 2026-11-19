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
async function mount(page,allowed=true,canSubmit=false){
 await page.goto('./');
 await page.evaluate(async({people,allowed,canSubmit})=>{
  const {mountLiveIamAdmin}=await import('/adphor-platform/src/js/ui-iam-live.js');
  const root=document.createElement('main');root.id='iam-legacy-test';
  document.body.replaceChildren(root);
  window.__legacyCommands=0;
  window.__legacyPayloads=[];
  const iam={
   read:async()=>{if(!allowed)throw Error('MFA AAL2 missing');return{
    enabled:true,accounts:[],audit:[],
    legacy_review:{total:people.length,candidates:people}
   };},
   command:async(payload)=>{
    window.__legacyCommands++;window.__legacyPayloads.push(payload);
    if(!canSubmit)throw Error('No account changes in this test');
    return {status:'invited'};
   }
  };
  await mountLiveIamAdmin(root,{iam,projects:[
   {id:'qa-a',name:'Edificio sintético QA'},
   {id:'qa-b',name:'Edificio secundario QA'}
  ]});
 },{people:fixture,allowed,canSubmit});
}
test('historical onboarding preselects ONLY name and wipes stale invitation credentials and grants',async({page})=>{
 await mount(page);
 const invite=page.locator('form.access-workflow').first();
 await invite.locator('input[type=text]').fill('Otro Empleado');
 await invite.locator('input[type=email]').fill('wrong@example.invalid');
 await invite.getByLabel('Permitir Edificio sintético QA').check();
 await invite.getByLabel('Permitir Edificio secundario QA').check();
 await invite.locator('.access-grant-row').first().locator('select').selectOption('admin');
 await invite.locator('.access-grant-row').last().locator('select').selectOption('technician');
 await invite.locator('textarea').fill('Otro permiso aprobado');
 await page.getByRole('button',{name:'Preseleccionar j.guzman para invitación'}).click();
 await expect(invite.locator('input[type=text]')).toHaveValue('Persona Operativa QA');
 await expect(invite.locator('input[type=email]')).toHaveValue('');
 await expect(invite.getByLabel('Permitir Edificio sintético QA')).not.toBeChecked();
 await expect(invite.getByLabel('Permitir Edificio secundario QA')).not.toBeChecked();
 await expect(invite.locator('.access-grant-row').first().locator('select')).toHaveValue('viewer');
 await expect(invite.locator('.access-grant-row').last().locator('select')).toHaveValue('viewer');
 await expect(invite.locator('textarea')).toHaveValue('');
 await expect(page.getByRole('status')).toContainText('Se asociará a la invitación solo tras validación de servidor');
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

test('administrator can propose multiple property-specific roles in one invitation, without real Auth calls',async({page})=>{
 await mount(page,true,true);
 const invite=page.locator('form.access-workflow').first();
 await page.evaluate(()=>{window.confirm=()=>true;});
 await invite.locator('input[type=text]').fill('Persona Operativa QA');
 await invite.locator('input[type=email]').fill('personal@example.invalid');
 await invite.getByLabel('Permitir Edificio sintético QA').check();
 await invite.getByLabel('Permitir Edificio secundario QA').check();
 await invite.locator('.access-grant-row').first().locator('select').selectOption('viewer');
 await invite.locator('.access-grant-row').last().locator('select').selectOption('technician');
 await invite.locator('textarea').fill('Autorización de prueba documentada');
 await invite.getByRole('button',{name:'Enviar invitación real'}).click();
 await expect.poll(()=>page.evaluate(()=>window.__legacyCommands)).toBe(1);
 const calls=await page.evaluate(()=>window.__legacyPayloads);
 expect(calls).toHaveLength(1);
 expect(calls[0].action).toBe('invite');
 expect(calls[0].assignments).toEqual([
  {project_id:'qa-a',role:'viewer'},
  {project_id:'qa-b',role:'technician'}
 ]);
 expect(calls[0].email).toBe('personal@example.invalid');
});
test('without property selection no invitation command can be sent',async({page})=>{
 await mount(page,true,true);
 const invite=page.locator('form.access-workflow').first();
 await page.evaluate(()=>{window.confirm=()=>true;});
 await invite.locator('input[type=text]').fill('Persona QA');
 await invite.locator('input[type=email]').fill('personal@example.invalid');
 await invite.locator('textarea').fill('Autorización de prueba documentada');
 await invite.getByRole('button',{name:'Enviar invitación real'}).click();
 await expect(page.getByRole('status')).toContainText('al menos una copropiedad');
 expect(await page.evaluate(()=>window.__legacyCommands)).toBe(0);
});

test('preselected historical user carries exact alias to backend but no legacy PIN or permissions',async({page})=>{
 await mount(page,true,true);
 const invite=page.locator('form.access-workflow').first();
 await page.evaluate(()=>{window.confirm=()=>true;});
 await page.getByRole('button',{name:'Preseleccionar j.guzman para invitación'}).click();
 await invite.locator('input[type=email]').fill('personal@example.invalid');
 await invite.getByLabel('Permitir Edificio sintético QA').check();
 await invite.locator('textarea').fill('Identidad confirmada por administrador QA');
 await invite.getByRole('button',{name:'Enviar invitación real'}).click();
 await expect.poll(()=>page.evaluate(()=>window.__legacyCommands)).toBe(1);
 const command=(await page.evaluate(()=>window.__legacyPayloads))[0];
 expect(command.historic_alias).toBe('j.guzman');
 expect(command.assignments).toEqual([{project_id:'qa-a',role:'viewer'}]);
 expect(JSON.stringify(command)).not.toContain('pin');
});
test('editing a preselected name invalidates stale alias binding',async({page})=>{
 await mount(page,true,true);await page.evaluate(()=>{window.confirm=()=>true;});
 const invite=page.locator('form.access-workflow').first();
 await page.getByRole('button',{name:'Preseleccionar j.guzman para invitación'}).click();
 await invite.locator('input[type=text]').fill('Persona distinta QA');
 await invite.locator('input[type=email]').fill('persona@example.invalid');
 await invite.getByLabel('Permitir Edificio sintético QA').check();
 await invite.locator('textarea').fill('Autorización verificada de alta QA');
 await invite.getByRole('button',{name:'Enviar invitación real'}).click();
 await expect.poll(()=>page.evaluate(()=>window.__legacyCommands)).toBe(1);
 expect((await page.evaluate(()=>window.__legacyPayloads))[0].historic_alias).toBeUndefined();
});
