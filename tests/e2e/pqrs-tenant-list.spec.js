import {test,expect} from '@playwright/test';

test('GAUNTLET PQRS never renders a foreign property case when repository returns mixed data',async({page})=>{
 await page.goto('./');
 await page.evaluate(async()=>{
   const {mountPqrs}=await import('/adphor-platform/src/js/ui-pqrs.js');
   document.body.replaceChildren();
   const root=document.createElement('main');document.body.append(root);
   mountPqrs(root,{projectId:'building-a',projectName:'Edificio A',role:'admin',
     repository:{localDemo:true,list:async()=>[
       {id:'CASE-A',project_id:'building-a',subject:'Caso del edificio autorizado',
        description:'Registro QA de prueba',status:'open',priority:'medio',version:1},
       {id:'CASE-B',project_id:'building-b',subject:'NO MOSTRAR: edificio vecino',
        description:'Dato de copropiedad ajena',status:'open',priority:'medio',version:1}
     ]}});
 });
 await expect(page.locator('.pqrs-message')).toContainText('No se pudo verificar el listado PQRS');
 await expect(page.locator('[data-cases]')).toContainText('Comprueba tu acceso y pulsa Actualizar lista');
 await expect(page.locator('[data-cases]')).not.toContainText('NO MOSTRAR');
 await expect(page.locator('[data-cases] article')).toHaveCount(0);
});
test('GAUNTLET PQRS rejects duplicated case cards and preserves a usable retry control',async({page})=>{
 await page.goto('./');
 await page.evaluate(async()=>{
   const {mountPqrs}=await import('/adphor-platform/src/js/ui-pqrs.js');
   document.body.replaceChildren();
   const root=document.createElement('main');document.body.append(root);
   const caseRow={id:'CASE-A',project_id:'building-a',subject:'Una sola novedad',
     description:'Caso de prueba',status:'open',priority:'medio',version:1};
   mountPqrs(root,{projectId:'building-a',repository:{localDemo:true,list:async()=>[caseRow,caseRow]}});
 });
 await expect(page.locator('.pqrs-message')).toContainText('No se pudo verificar el listado PQRS');
 await expect(page.locator('[data-cases] article')).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Actualizar lista'})).toBeEnabled();
});
test('GAUNTLET PQRS keeps correct cases and avoids executing HTML from case content',async({page})=>{
 await page.goto('./');
 await page.evaluate(async()=>{
   const {mountPqrs}=await import('/adphor-platform/src/js/ui-pqrs.js');
   document.body.replaceChildren();
   const root=document.createElement('main');document.body.append(root);
   mountPqrs(root,{projectId:'building-a',repository:{localDemo:true,list:async()=>[
     {id:'CASE-A',project_id:'building-a',subject:'<img src=x onerror=alert(1)>',
      description:'Caso seguro',status:'open',priority:'medio',version:1}
   ]}});
 });
 await expect(page.locator('[data-cases] article')).toHaveCount(1);
 await expect(page.locator('[data-cases] article')).toContainText('<img src=x onerror=alert(1)>');
 await expect(page.locator('[data-cases] img')).toHaveCount(0);
});
