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
  const allowed = await page.locator('.sidebar nav button[data-page]').count();
  await expect(tiles).toHaveCount(allowed);
  expect(allowed).toBeGreaterThanOrEqual(13);
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
test('ADPHOR ONE: complete desktop menu exposes every authorized feature as a circle',async({page})=>{
 await enterDemo(page);
 expect(await activateFullWidth(page)).toBe(true);
 await expect(page.locator('.sidebar')).toBeHidden();
 await expect(page.locator('.adphor-one-topbrand')).toBeVisible();
 const allowed=await page.locator('.sidebar nav button[data-page]').evaluateAll(nodes=>nodes.map(n=>n.dataset.page));
 const actual=await page.locator('.adphor-one-grid .adphor-one-tile').evaluateAll(nodes=>nodes.map(n=>n.dataset.page));
 expect(new Set(actual)).toEqual(new Set(allowed));
 expect(actual.length).toBe(allowed.length);
 await expect(page.locator('.adphor-one-more')).toHaveCount(0);
 await expect(page.locator('.adphor-one-module-section')).toHaveCount(3);
 for(const id of ['dashboard','unified','tickets','recorridos','mine','areas','agenda','meetings','pqrs','visits','reports','agent-history']){
  await expect(page.locator('.adphor-one-grid [data-page="'+id+'"]')).toHaveCount(1);
 }
 await page.locator('.adphor-one-grid [data-page="tickets"]').click();
 await expect(page.locator('.sidebar nav button[data-page="tickets"]')).toHaveAttribute('aria-current','page');
 expect(await activateFullWidth(page)).toBe(true);
 await expect(page.locator('.sidebar')).toBeHidden();
 await page.getByRole('button',{name:'Volver a la pantalla de inicio'}).click();
 await expect(page.locator('.sidebar nav button[data-page="dashboard"]')).toHaveAttribute('aria-current','page');
 expect(await activateFullWidth(page)).toBe(true);
 await page.locator('.adphor-one-grid [data-page="pqrs"]').click();
 await expect(page.locator('.sidebar nav button[data-page="pqrs"]')).toHaveAttribute('aria-current','page');
});
test('ADPHOR ONE: full mobile menu has circles without hidden navigation or overflow',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.emulateMedia({reducedMotion:'reduce'});
 await enterDemo(page);
 expect(await activateFullWidth(page)).toBe(true);
 await expect(page.locator('.sidebar')).toBeHidden();
 const allowed=await page.locator('.sidebar nav button[data-page]').count();
 await expect(page.locator('.adphor-one-grid .adphor-one-tile')).toHaveCount(allowed);
 await expect(page.locator('.adphor-one-more')).toHaveCount(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();
 expect(axe.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)}))).toEqual([]);
 await page.locator('.adphor-one-grid [data-page="mine"]').click();
 await expect(page.locator('.sidebar nav button[data-page="mine"]')).toHaveAttribute('aria-current','page');
 expect(await activateFullWidth(page)).toBe(true);
 await page.getByRole('button',{name:'Volver a la pantalla de inicio'}).click();
 expect(await activateFullWidth(page)).toBe(true);
 await expect(page.locator('.adphor-one-grid .adphor-one-tile')).toHaveCount(allowed);
});
