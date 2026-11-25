import {test,expect} from '@playwright/test';

test('Agenda has one integrated visual interface in demo mode with no file picker and no simulated records',async({page})=>{
 await page.goto('./');
 await page.evaluate(async()=>{
  const {mountVerifiedAgenda}=await import('/adphor-platform/src/js/ui-verified-agenda.js');
  const root=document.createElement('div');root.id='qa-one-demo';document.body.append(root);
  mountVerifiedAgenda(root,{repo:{mode:'demo'},projectId:'p1',projectName:'Edificio Piloto'});
 });
 const view=page.locator('#qa-one-demo');
 await expect(view.locator('.adphor-integrated-agenda')).toHaveCount(1);
 await expect(view.locator('[data-report-file]')).toHaveCount(0);
 await expect(view.locator('.adphor-integrated-agenda-status')).toContainText('Demostración sin reuniones verificadas');
 const frame=page.frameLocator('#qa-one-demo iframe');
 await expect(frame.locator('.nav-item')).toHaveCount(8);
 await expect(frame.locator('#adphor-v4-source')).toContainText('Demostración sin reuniones verificadas');
});

test('Return to prior portal module rather than login or forced dashboard',async({page})=>{
 await page.goto('./');
 await page.evaluate(async()=>{
  const {mountVerifiedAgenda}=await import('/adphor-platform/src/js/ui-verified-agenda.js');
  const root=document.createElement('div');root.id='qa-return';document.body.append(root);
  window.__qaReturn='not-called';
  mountVerifiedAgenda(root,{repo:{mode:'demo'},projectId:'p1',projectName:'Edificio Piloto',
   onClose:()=>{window.__qaReturn='previous-module';root.replaceChildren();}});
 });
 await page.locator('#qa-return .adphor-integrated-agenda-back').click();
 await expect.poll(()=>page.evaluate(()=>window.__qaReturn)).toBe('previous-module');
 await expect(page.locator('#qa-return iframe')).toHaveCount(0);
});
