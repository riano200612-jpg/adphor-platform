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
  await page.locator('[name=description]').fill('Prueba controlada sin acceso a datos reales');
  await page.locator('[type=submit]').click();
  await expect(page.locator('[type=submit]')).toBeDisabled();
  await page.locator('form').evaluate(form => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  expect(await page.evaluate(() => window.creates)).toBe(1);
  await page.evaluate(() => window.releaseCreate());
  await expect(page.locator('[role=status]')).toContainText('Radicado: QA-123');
  await expect(page.locator('[role=status]')).toContainText('No se pudo actualizar la lista');
  await expect(page.locator('[type=submit]')).toBeEnabled();
});
