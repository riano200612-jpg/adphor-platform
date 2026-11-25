import {test,expect} from '@playwright/test';

test('Visitas: search filters can be cleared without changing stored visits',async({page})=>{
 await page.goto('./');
 await page.evaluate(async()=>{
   const {mountVisitPreparation}=await import('/adphor-platform/src/js/ui-visit-preparation.js');
   const host=document.createElement('div');host.id='qa-filter-visit';document.body.append(host);
   const when='2026-12-01T15:00:00Z';
   const rows=[{project_id:'p1',request_id:'r1',motive:'Inspección de cubiertas',scheduled_at:when,responsible_id:'u1'}];
   mountVisitPreparation(host,{projectId:'p1',projectName:'Edificio Piloto',
     projects:[{id:'p1',name:'Edificio Piloto'}],members:[{project_id:'p1',user_id:'u1',name:'Delegada Piloto'}],
     visitRepository:{list:async()=>rows},canCreate:false});
 });
 const host=page.locator('#qa-filter-visit');
 await expect(host.locator('[data-visit-results] li')).toHaveCount(1);
 const clear=host.locator('[data-visit-clear-filters]');
 await expect(clear).toBeHidden();
 await host.locator('[data-visit-search]').fill('no coincide');
 await expect(host.locator('[data-visit-results] li')).toHaveCount(0);
 await expect(clear).toBeVisible();
 await expect(host.locator('[data-list-status]')).toContainText('Ninguna visita coincide');
 await clear.click();
 await expect(host.locator('[data-visit-search]')).toHaveValue('');
 await expect(host.locator('[data-visit-results] li')).toHaveCount(1);
 await expect(clear).toBeHidden();
});
test('PQRS: status filter reset preserves tenant-bound list query',async({page})=>{
 await page.goto('./');
 await page.evaluate(async()=>{
   const {mountPqrs}=await import('/adphor-platform/src/js/ui-pqrs.js');
   const host=document.createElement('div');host.id='qa-filter-pqrs';document.body.append(host);
   window.__qaPqrsQueries=[];
   mountPqrs(host,{repository:{localDemo:true,list:async(projectId,status)=>{
     window.__qaPqrsQueries.push({projectId,status});return [];
   }},projectId:'p1',projectName:'Edificio Piloto',role:'delegada'});
 });
 const host=page.locator('#qa-filter-pqrs');
 const filter=host.locator('[data-filter]');
 const clear=host.locator('[data-clear-filter]');
 await expect(clear).toBeHidden();
 await filter.selectOption('in_progress');
 await expect(clear).toBeVisible();
 await expect(filter.locator('option:checked')).toHaveText('En atención');
 await clear.click();
 await expect(filter).toHaveValue('');
 await expect(clear).toBeHidden();
 await expect.poll(()=>page.evaluate(()=>window.__qaPqrsQueries.at(-1))).toEqual({projectId:'p1',status:''});
});
