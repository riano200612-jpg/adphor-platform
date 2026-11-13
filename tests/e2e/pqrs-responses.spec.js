import {test,expect} from '@playwright/test';

test('PQRS shows persisted replies alongside transitions and never executes reply markup',async({page})=>{
 await page.goto('./');
 await page.evaluate(async()=>{
   const {mountPqrs}=await import('/adphor-platform/src/js/ui-pqrs.js');
   document.body.innerHTML='<main id="pqrs-tested"></main>';
   const replies=[{id:'r0',case_id:'QA-C1',body:'<img src=x onerror=alert(1)>',created_at:'2026-11-13T12:00:00Z'}];
   window.qaResponsesSaved=0;
   window.qaResponsesRead=0;
   mountPqrs(document.querySelector('#pqrs-tested'),{
      projectId:'qa-property',projectName:'Copropiedad controlada',role:'admin',members:[],
      repository:{
        localDemo:false,
        list:async()=>[{id:'QA-C1',project_id:'qa-property',subject:'Radicado prueba',
          description:'Caso trazable',status:'open',priority:'medio',version:1}],
        history:async()=>[{case_id:'QA-C1',occurred_at:'2026-11-13T11:00:00Z',old_status:null,new_status:'open'}],
        responses:async()=>{window.qaResponsesRead++;return replies.map(x=>({...x}));},
        respond:async(_p,_id,body)=>{window.qaResponsesSaved++;await new Promise(done=>{window.qaRelease=done;});replies.push({id:'r1',case_id:'QA-C1',body,created_at:'2026-11-13T13:00:00Z'});}
      }
   });
 });
 const card=page.locator('.pqrs-cases article').first();
 await expect(card).toContainText('Radicado prueba');
 await card.getByRole('button',{name:'Ver historial'}).click();
 await expect(card.locator('[data-pqrs-responses]')).toContainText('<img src=x onerror=alert(1)>');
 await expect(card.locator('img')).toHaveCount(0);
 await expect(card.locator('[data-pqrs-timeline]')).toContainText('creado → open');
 await card.getByText('Responder y gestionar caso',{exact:true}).click();
 const reply=card.getByRole('textbox',{name:'Respuesta'});
 await reply.fill('Seguimiento seguro guardado en PostgreSQL QA');
 const send=card.getByRole('button',{name:'Guardar respuesta'});
 await send.click();
 await expect(send).toBeDisabled();
 await send.evaluate(button=>button.click());
 expect(await page.evaluate(()=>window.qaResponsesSaved)).toBe(1);
 await page.evaluate(()=>window.qaRelease());
 await expect(card.locator('[data-pqrs-responses]')).toContainText('Seguimiento seguro guardado en PostgreSQL QA');
 await expect(send).toBeEnabled();
 expect(await page.evaluate(()=>window.qaResponsesSaved)).toBe(1);
});
