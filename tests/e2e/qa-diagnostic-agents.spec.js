import {test,expect} from '@playwright/test';

test('QA diagnosis agents visibly report actual read-only checks and blocked inference',async({page})=>{
 await page.goto('./');
 await page.evaluate(async()=>{
  document.body.replaceChildren();
  const container=document.createElement('main');document.body.append(container);
  const {mountQaDiagnosticAgents}=await import('/adphor-platform/src/js/ui-qa-agent-diagnostics.js');
  window.__qaCounters={ready:0,staff:0};
  mountQaDiagnosticAgents(container,{
   hostname:'qa-integral-claude-reviewed.adphor-platform.pages.dev',mode:'cloud',role:'admin',
   userId:'qa-person',projectId:'source-1',authorizedProjects:['source-1'],
   corporateAdmin:true,tickets:[{id:'a',project_id:'source-1',status:'Pendiente',assignee:null}],
   availablePages:['agent-history','pqrs','meetings','visits'],missReady:true,
   repo:{
     agentReadiness:async()=>{window.__qaCounters.ready++;return{
       registry_ready:true,rules_ready:false,reviews_ready:false,models_ready:false
     };},
     corporateStaffDirectory:async()=>{window.__qaCounters.staff++;return[
       {active:true,photo_path:'private-secret-path'},{active:true,photo_path:null}
     ];}
   }
  });
 });
 const panel=page.getByRole('heading',{name:'Agentes de verificación QA · solo lectura'});
 await expect(panel).toBeVisible();
 await expect(page.locator('.qa-agent-watch-item')).toHaveCount(6);
 await expect(page.locator('[data-agent="acceso"]')).toContainText('Verificado');
 await expect(page.locator('[data-agent="equipo"]')).toContainText('2 colaboradores activos');
 await expect(page.locator('[data-agent="motor"]')).toContainText('deshabilitados');
 await expect(page.getByRole('status')).toContainText('Ronda finalizada: 6 verificaciones');
 expect(await page.locator('main').innerText()).not.toContain('private-secret-path');
 expect(await page.locator('main').innerText()).not.toContain('qa-person');
 await page.getByRole('button',{name:'Repetir auditoría'}).click();
 await expect(page.locator('.qa-agent-watch-item')).toHaveCount(6);
 expect(await page.evaluate(()=>window.__qaCounters)).toEqual({ready:2,staff:2});
});
test('non-admin or wrong site never starts probes',async({page})=>{
 await page.goto('./');
 await page.evaluate(async()=>{
  document.body.replaceChildren();
  const main=document.createElement('main');document.body.append(main);
  const {mountQaDiagnosticAgents}=await import('/adphor-platform/src/js/ui-qa-agent-diagnostics.js');
  window.__calls=0;
  mountQaDiagnosticAgents(main,{hostname:'adphor-platform.pages.dev',mode:'cloud',role:'admin',
    userId:'u',projectId:'source-1',authorizedProjects:['source-1'],repo:{
      agentReadiness:async()=>{window.__calls++;return {registry_ready:true};}
    }});
 });
 await expect(page.getByRole('button',{name:'Repetir auditoría'})).toHaveCount(0);
 expect(await page.evaluate(()=>window.__calls)).toBe(0);
});
