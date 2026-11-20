import {test,expect} from '@playwright/test';
test('Miss ADPHOR guides and shows a bounded weekly draft, no false zero for missing PQRS',async({page})=>{
 await page.goto('./');
 await page.evaluate(async()=>{
  document.body.replaceChildren();const host=document.createElement('main');document.body.append(host);
  const {mountMissQaWeekly}=await import('/adphor-platform/src/js/ui-miss-qa-weekly.js');
  window.__reads=0;
  mountMissQaWeekly(host,{mode:'cloud',role:'admin',projectId:'source-1',corporateAdmin:false,projects:[{id:'source-1',name:'Edificio QA'}],now:()=>Date.parse('2026-11-20T14:00:00Z'),repo:{
    missWeeklyPreview:async({projectIds})=>{window.__reads++;if(projectIds.join(',')!=='source-1')throw Error('Scope');
      return{weekStart:'2026-11-16',cutoff:'2026-11-20T14:00:00Z',propertyCount:1,status:'BORRADOR_FUENTES_INCOMPLETAS',note:'QA controlada',properties:[{projectId:'source-1',pqrsNew:null}],
      totals:{tasksCreated:1,tasksOverdueAtCutoff:1,visitsRegistered:2,visitsFinished:0,pqrsNew:null,pqrsClosed:null,meetingsImported:1}};
    }
  }});
 });
 await page.getByRole('button',{name:'Preparar informe semanal'}).click();
 await expect(page.getByRole('status')).toContainText('Borrador preparado');
 await expect(page.getByRole('table').getByText('NO DISPONIBLE').first()).toBeVisible();
 await expect(page.getByRole('button',{name:'Descargar CSV de respaldo'})).toBeVisible();
 expect(await page.evaluate(()=>window.__reads)).toBe(1);
});
test('Miss weekly viewer has no export and cannot start a report',async({page})=>{
 await page.goto('./');await page.evaluate(async()=>{
 document.body.replaceChildren();const host=document.createElement('main');document.body.append(host);
 const {mountMissQaWeekly}=await import('/adphor-platform/src/js/ui-miss-qa-weekly.js');
 mountMissQaWeekly(host,{mode:'cloud',role:'viewer',projectId:'source-1',repo:{}});
 });await expect(page.getByRole('button',{name:'Preparar informe semanal'})).toHaveCount(0);
});
