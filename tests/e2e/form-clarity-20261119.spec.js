import {test,expect} from '@playwright/test';

test('IAM: search across 43 copropiedades, retain selections and refuse incomplete requests',async({page})=>{
 await page.goto('./');
 await page.evaluate(async()=>{
  const {mountLiveIamAdmin}=await import('/adphor-platform/src/js/ui-iam-live.js');
  const root=document.createElement('main');root.id='qa-easy-iam-test';document.body.append(root);
  window.__formClarityIamWrites=0;
  const projects=Array.from({length:43},(_,i)=>({id:'qa-property-'+(i+1),name:'Copropiedad QA '+(i+1)}));
  const iam={
   async read(){return {enabled:true,accounts:[],audit:[]};},
   async command(){window.__formClarityIamWrites++;throw Error('Do not write accounts in UI tests');}
  };
  await mountLiveIamAdmin(root,{iam,projects});
 });
 const root=page.locator('#qa-easy-iam-test');
 const invite=root.locator('form.access-workflow').first();
 const search=invite.getByRole('searchbox',{name:'Buscar copropiedad para asignar permiso'});
 await expect(search).toBeVisible();
 await expect(invite.locator('.access-grant-row:visible')).toHaveCount(8);
 await expect(invite.locator('.access-grants-count')).toContainText('8 de 43');
 await invite.getByRole('button',{name:'Enviar invitación real'}).click();
 await expect(invite.locator('[data-access-form-error]')).toContainText('nombre completo');
 await expect(invite.locator('input[type=text]').first()).toBeFocused();
 await search.fill('Copropiedad QA 42');
 await expect(invite.locator('.access-grant-row:visible')).toHaveCount(1);
 await invite.getByLabel('Permitir Copropiedad QA 42').check();
 await invite.getByLabel('Rol para Copropiedad QA 42').selectOption('technician');
 await expect(invite.locator('.access-grants-count')).toContainText('1 seleccionadas');
 await search.fill('');
 await expect(invite.locator('.access-grant-row:visible')).toHaveCount(8);
 await expect(invite.locator('.access-grants-count')).toContainText('1 seleccionadas');
 await search.fill('Copropiedad QA 42');
 await expect(invite.getByLabel('Permitir Copropiedad QA 42')).toBeChecked();
 await expect(invite.getByLabel('Rol para Copropiedad QA 42')).toHaveValue('technician');
 await expect(invite.getByRole('button',{name:'Ver las 43 copropiedades'})).toHaveCount(0);
 await search.fill('');
 await invite.getByRole('button',{name:'Ver las 43 copropiedades'}).click();
 await expect(invite.locator('.access-grant-row:visible')).toHaveCount(43);
 expect(await page.evaluate(()=>window.__formClarityIamWrites)).toBe(0);
});

test('PQRS: missing required fields show plain-language errors and preserve draft',async({page})=>{
 await page.goto('./');
 await page.evaluate(async()=>{
  const {mountPqrs}=await import('/adphor-platform/src/js/ui-pqrs.js');
  const root=document.createElement('main');root.id='qa-pqrs-clarity';document.body.append(root);
  window.__pqrsClarityWrites=0;
  mountPqrs(root,{projectId:'synthetic-property',projectName:'QA simulada',repository:{
    localDemo:true,async list(){return [];},
    async create(){window.__pqrsClarityWrites++;throw Error('No persistence in this test');}
  }});
 });
 const root=page.locator('#qa-pqrs-clarity');
 const form=root.locator('form.pqrs-form');
 await form.locator('[type=submit]').click();
 await expect(form.locator('.pqrs-form-error')).toContainText('Escribe un asunto');
 await expect(form.locator('[name=subject]')).toHaveAttribute('aria-invalid','true');
 await form.locator('[name=subject]').fill('Necesito ayuda con un pasillo');
 await form.locator('[type=submit]').click();
 await expect(form.locator('.pqrs-form-error')).toContainText('Explica qué ocurrió');
 await expect(form.locator('[name=subject]')).toHaveValue('Necesito ayuda con un pasillo');
 await expect(form.locator('[name=description]')).toHaveAttribute('aria-invalid','true');
 await form.locator('[name=description]').fill('La iluminación está apagada.');
 await expect(form.locator('.pqrs-form-error')).toBeEmpty();
 expect(await page.evaluate(()=>window.__pqrsClarityWrites)).toBe(0);
});

test('Visitas: show one native date, manual entry only when requested and useful live instructions',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('./');
 await page.evaluate(async()=>{
  const {mountVisitPreparation}=await import('/adphor-platform/src/js/ui-visit-preparation.js');
  const root=document.createElement('main');root.id='qa-visit-clarity';document.body.append(root);
  mountVisitPreparation(root,{
   projectId:'qa-property',projectName:'QA Sintética',members:[
    {project_id:'qa-property',user_id:'employee1',name:'Responsable QA',role:'admin'}
   ],projects:[{id:'qa-property',name:'QA Sintética'}],
   canCreate:true,visitRepository:{list:async()=>[],save:async()=>{throw Error('No real visits')}}
  });
 });
 const root=page.locator('#qa-visit-clarity');
 const alt=root.locator('[name=startText]');
 await expect(root.locator('[name=start]')).toBeVisible();
 await expect(alt).toBeHidden();
 await expect(root.locator('[data-visit-form-hint]')).toContainText('tipo o motivo');
 await root.locator('[name=kind]').fill('Recorrido de seguridad QA sintético');
 await root.getByText('Prefiero escribir la fecha y hora').click();
 await expect(alt).toBeVisible();
 await alt.fill('2026-11-22 09:30');
 await expect(root.locator('[name=start]')).toHaveValue('2026-11-22T09:30');
 await root.locator('[name=responsible]').selectOption('employee1');
 await expect(root.locator('[data-visit-form-hint]')).toContainText('Los datos están completos');
 await expect(root.getByRole('button',{name:'Revisar visita'})).toBeEnabled();
 await root.getByRole('button',{name:'Revisar visita'}).click();
 await expect(root.locator('[data-summary]')).toContainText('Recorrido de seguridad QA sintético');
});
