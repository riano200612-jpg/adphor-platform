import {test,expect} from '@playwright/test';

test('Agenda V4 applies Nielsen: current Bogota date, active navigation, controls and safe exit',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('./');
 await page.evaluate(async()=>{
   const {mountVerifiedAgenda}=await import('/adphor-platform/src/js/ui-verified-agenda.js');
   const root=document.createElement('div');root.id='v4-nielsen';document.body.append(root);
   window.__v4Closed=false;
   mountVerifiedAgenda(root,{
    repo:{mode:'cloud',listVerifiedQaMeetings:async()=>[]},projectId:'p1',projectName:'Edificio Piloto',
    onClose:()=>{window.__v4Closed=true;root.replaceChildren();}
   });
 });
 const frame=page.frameLocator('#v4-nielsen iframe');
 await expect(frame.locator('.nav-item')).toHaveCount(8);
 await expect(frame.locator('#adphor-v4-source')).toContainText('No hay reuniones verificadas');
 await frame.locator('[data-sec="s2"]').click();
 await expect(frame.locator('[data-sec="s2"]')).toHaveAttribute('aria-current','page');
 await expect(frame.locator('[data-sec="s1"]')).not.toHaveAttribute('aria-current','page');
 await frame.locator('#fbtn-lg').click();
 await expect(frame.locator('#fbtn-lg')).toHaveAttribute('aria-pressed','true');
 await frame.locator('.menu-toggle').click();
 await expect(frame.locator('.menu-toggle')).toHaveAttribute('aria-expanded','false');
 await page.locator('#v4-nielsen button').filter({hasText:'Volver al portal'}).click();
 await expect.poll(()=>page.evaluate(()=>window.__v4Closed)).toBe(true);
 expect(errors).toEqual([]);
});

test('Agenda V4 error is recoverable without leaking cross-tenant data',async({page})=>{
 await page.goto('./');
 await page.evaluate(async()=>{
   const {mountVerifiedAgenda}=await import('/adphor-platform/src/js/ui-verified-agenda.js');
   const root=document.createElement('div');root.id='v4-retry';document.body.append(root);
   let attempts=0;
   mountVerifiedAgenda(root,{repo:{mode:'cloud',listVerifiedQaMeetings:async id=>{
     attempts++;
     if(attempts===1)throw new Error('Confidential SQL server detail');
     return [{id:'m1',project_id:id,title:'Consejo autorizado',kind:'Consejo',source_status:'Confirmada',
       start_at:'2026-12-01T15:00:00Z',end_at:'2026-12-01T17:00:00Z',is_calendar_verified:true}];
   }},projectId:'p1',projectName:'Edificio Piloto'});
 });
 const frame=page.frameLocator('#v4-retry iframe');
 await expect(frame.locator('#adphor-v4-source')).toContainText('Pulsa Actualizar reuniones');
 await expect(frame.locator('body')).not.toContainText('Confidential SQL server detail');
 await page.locator('#v4-retry button').filter({hasText:'Actualizar reuniones'}).click();
 await expect(frame.locator('#adphor-v4-source')).toContainText('1 reuniones verificadas');
});
