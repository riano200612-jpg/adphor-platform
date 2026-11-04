import { test, expect } from '@playwright/test';

test('PQRS blocks concurrent submission and preserves confirmation if refresh fails', async ({ page }) => {
  await page.goto('./');
  await page.evaluate(async () => {
    const { mountPqrs } = await import('/adphor-platform/src/js/ui-pqrs.js');
    document.body.innerHTML = '<main id="test-root"></main>';
    window.creates = 0;
    let reads = 0;
    const repository = {
      localDemo: true,
      list: async () => { if (++reads > 1) throw Error('Network unavailable'); return []; },
      create: async () => { window.creates++; await new Promise(resolve => { window.releaseCreate = resolve; }); return { id: 'QA-123', status: 'open' }; }
    };
    mountPqrs(document.querySelector('#test-root'), { repository, projectId: 'qa-test' });
  });
  await page.locator('[name=subject]').fill('Solicitud QA');
  await page.locator('form [name=description]').fill('Prueba controlada sin acceso a datos reales');
  await page.locator('[type=submit]').click();
  await expect(page.locator('[type=submit]')).toBeDisabled();
  await page.locator('form').evaluate(form => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  expect(await page.evaluate(() => window.creates)).toBe(1);
  await page.evaluate(() => window.releaseCreate());
  await expect(page.locator('[role=status]')).toContainText('Radicado: QA-123');
  await expect(page.locator('[role=status]')).toContainText('No se pudo actualizar la lista');
  await expect(page.locator('[type=submit]')).toBeEnabled();
});

test('PQRS retries incomplete evidence using the confirmed case without duplicate creation',async({page})=>{
 await page.goto('./');
 await page.evaluate(async()=>{
  const {mountPqrs}=await import('/adphor-platform/src/js/ui-pqrs.js');
  document.body.innerHTML='<main id="test-root"></main>';
  window.creates=0;window.uploads=0;
  mountPqrs(document.querySelector('#test-root'),{projectId:'qa-test',repository:{
   localDemo:true,list:async()=>[],create:async()=>{window.creates++;return {id:'QA-456',status:'open'};},
   uploadEvidence:async()=>{if(++window.uploads===1)throw Error('Conexión interrumpida');return [{id:'file-1'}];}
  }});
 });
 await page.locator('[name=subject]').fill('Solicitud con evidencia QA');
 await page.locator('form [name=description]').fill('Prueba sintética de reintento');
 await page.locator('input[type=file]').setInputFiles({name:'evidence.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.7 QA synthetic')});
 await page.locator('[type=submit]').click();
 await expect(page.locator('[role=status]')).toContainText('Radicado: QA-456. Evidencias incompletas.');
 await expect(page.locator('[name=subject]')).toBeDisabled();
 await page.locator('[type=submit]').click();
 await expect(page.locator('[role=status]')).toContainText('Radicado: QA-456');
 await expect(page.locator('[role=status]')).not.toContainText('incompletas');
 expect(await page.evaluate(()=>window.creates)).toBe(1);
 expect(await page.evaluate(()=>window.uploads)).toBe(2);
 await expect(page.locator('[name=subject]')).toBeEnabled();
 await page.screenshot({path:'qa/corrective-20261104/pqrs-retry.png',fullPage:true});
});
