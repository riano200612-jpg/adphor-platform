import {test,expect} from '@playwright/test';

test('authorized companion cards show roles, load a signed image and allow no escort',async({page})=>{
 await page.goto('./');
 await page.evaluate(async()=>{
  const {drawCompanionOptions}=await import('/adphor-platform/src/js/ui-companion-options.js');
  document.body.innerHTML='<main class="panel"><h1>Acompañamientos · prueba sintética QA</h1><form><div class="meeting-escort-carousel" id="choices"></div></form></main>';
  const canvas=document.createElement('canvas');canvas.width=92;canvas.height=92;const context=canvas.getContext('2d');context.fillStyle='#264b6b';context.fillRect(0,0,92,92);context.fillStyle='white';context.font='24px sans-serif';context.fillText('QA',26,54);
  drawCompanionOptions(document.querySelector('#choices'),[{id:'qa-staff',nombre:'Colaborador sintético QA',leyendaRol:'Gerencia de prueba',photoStoragePath:'qa/staff.png'}],{photoUrl:async()=>canvas.toDataURL()});
 });
 await expect(page.getByText('Gerencia de prueba')).toBeVisible();
 await expect(page.locator('img')).toHaveJSProperty('naturalWidth',92);
 await page.locator('input[value="qa-staff"]').check();
 await expect(page.locator('input[value=""]')).not.toBeChecked();
 await page.locator('input[value=""]').check();
 await expect(page.locator('input[value="qa-staff"]')).not.toBeChecked();
 await page.screenshot({path:'qa/corrective-20261104/companions-synthetic.png',fullPage:true});
});
