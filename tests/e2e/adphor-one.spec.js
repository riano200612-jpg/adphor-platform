import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function enterDemo(page) {
  await page.goto('./');
  await page.getByRole('button',{name:'Explorar demostración'}).click();
  await expect(page.locator('#project-select')).toBeVisible();
}
async function activateQaVisualInLocalTest(page) {
  // The live UI remains host-scoped to QA Integral; only this isolated Playwright
  // test invokes the presentation function directly on localhost.
  return page.evaluate(async () => {
    const {enhanceAdphorOneDashboard}=await import('/adphor-platform/src/js/ui-adphor-one.js');
    return enhanceAdphorOneDashboard(document);
  });
}
test('ADPHOR ONE: circular dashboard preserves authorized existing navigation',async({page})=>{
  await enterDemo(page);
  expect(await activateQaVisualInLocalTest(page)).toBe(true);
  const grid=page.locator('.adphor-one-grid');
  const tiles=grid.locator('.adphor-one-tile');
  await expect(grid).toBeVisible();
  expect(await tiles.count()).toBeGreaterThanOrEqual(7);
  expect(await tiles.count()).toBeLessThanOrEqual(8);
  for(const id of ['agenda','pqrs','visits','properties','reports','meetings','agent-history']){
    await expect(grid.locator('[data-page="'+id+'"]')).toHaveCount(1);
  }
  await expect(grid.locator('[data-page="pqrs"] small')).not.toBeEmpty();
  await expect(page.locator('.dashboard-grid')).toBeVisible();
  // No duplicate tile is introduced on rerenders or observer callbacks.
  expect(await activateQaVisualInLocalTest(page)).toBe(false);
  await grid.locator('[data-page="agenda"]').click();
  await expect(page.locator('.sidebar [data-page="agenda"]')).toHaveAttribute('aria-current','page');
  await page.locator('.sidebar nav button[data-page="dashboard"]').click();
  expect(await activateQaVisualInLocalTest(page)).toBe(true);
  await page.locator('.adphor-one-grid [data-page="pqrs"]').click();
  await expect(page.locator('.sidebar [data-page="pqrs"]')).toHaveAttribute('aria-current','page');
});
test('ADPHOR ONE: responsive circles, reduced motion and WCAG on synthetic data',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.emulateMedia({reducedMotion:'reduce'});
  await enterDemo(page);
  expect(await activateQaVisualInLocalTest(page)).toBe(true);
  const orb=page.locator('.adphor-one-grid .adphor-one-tile').first();
  await expect(orb.locator('i')).toHaveCSS('border-radius','50%');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const results=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();
  expect(results.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)}))).toEqual([]);
});


async function activateFullWidth(page){
 return page.evaluate(async()=>{
   const {enhanceAdphorOneDashboard,enhanceAdphorOneShell}=await import('/adphor-platform/src/js/ui-adphor-one.js');
   const shell=enhanceAdphorOneShell(document);
   enhanceAdphorOneDashboard(document);
   return shell;
 });
}
test('ADPHOR ONE: immersive desktop home has no duplicate side navigation',async({page})=>{
 await enterDemo(page);
 expect(await activateFullWidth(page)).toBe(true);
 await expect(page.locator('.sidebar')).toBeHidden();
 await expect(page.locator('.adphor-one-topbrand')).toBeVisible();
 const count=await page.locator('.adphor-one-grid .adphor-one-tile').count();
 expect(count).toBeGreaterThanOrEqual(7);
 expect(count).toBeLessThanOrEqual(8);
 await expect(page.locator('.adphor-one-more-list [data-page="pqrs"]')).toHaveCount(0);
 await page.locator('.adphor-one-more summary').click();
 await expect(page.locator('.adphor-one-more-list button[data-page="tickets"]')).toBeVisible();
 await page.locator('.adphor-one-more-list button[data-page="tickets"]').click();
 await expect(page.locator('.sidebar nav button[data-page="tickets"]')).toHaveAttribute('aria-current','page');
 expect(await activateFullWidth(page)).toBe(true);
 await expect(page.locator('.sidebar')).toBeHidden();
 await page.getByRole('button',{name:'Volver a la pantalla de inicio'}).click();
 await expect(page.locator('.sidebar nav button[data-page="dashboard"]')).toHaveAttribute('aria-current','page');
 expect(await activateFullWidth(page)).toBe(true);
 await page.locator('.adphor-one-grid [data-page="pqrs"]').click();
 await expect(page.locator('.sidebar nav button[data-page="pqrs"]')).toHaveAttribute('aria-current','page');
});
test('ADPHOR ONE: compact mobile home avoids overflow and keeps accessible actions',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.emulateMedia({reducedMotion:'reduce'});
 await enterDemo(page);
 expect(await activateFullWidth(page)).toBe(true);
 await expect(page.locator('.sidebar')).toBeHidden();
 const count=await page.locator('.adphor-one-grid .adphor-one-tile').count();
 expect(count).toBeGreaterThanOrEqual(7);
 expect(count).toBeLessThanOrEqual(8);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();
 expect(axe.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)}))).toEqual([]);
 await page.locator('.adphor-one-more summary').click();
 await expect(page.locator('.adphor-one-more-list [data-page="tickets"]')).toBeVisible();
});
