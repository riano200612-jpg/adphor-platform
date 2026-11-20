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
  await expect(tiles).toHaveCount(allowed-1); // dashboard is Inicio, not a task
  expect(allowed).toBeGreaterThanOrEqual(13);
  for(const id of ['agenda','pqrs','visits','properties','reports','meetings','agent-history']){
    await expect(grid.locator('[data-page="'+id+'"]')).toHaveCount(1);
  }
  await expect(grid.locator('[data-page="pqrs"] small')).not.toBeEmpty();
  await expect(page.locator('.dashboard-grid')).toHaveCount(0);
  await expect(page.locator('.dashboard-intro')).toHaveCount(0);
  await expect(page.locator('#page-content .stats')).toHaveCount(0);
  await expect(page.locator('#page-content .page-heading')).toHaveCount(0);
  await expect(page.locator('#page-content h1')).toHaveText('¿Qué deseas gestionar?');
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
 expect(new Set(actual)).toEqual(new Set(allowed.filter(id=>id!=='dashboard')));
 expect(actual.length).toBe(allowed.length-1);
 await expect(page.locator('.adphor-one-more')).toHaveCount(0);
 await expect(page.locator('.adphor-one-module-section')).toHaveCount(3);
 for(const id of ['unified','tickets','recorridos','mine','areas','agenda','meetings','pqrs','visits','reports','agent-history']){
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
 await expect(page.locator('.adphor-one-grid .adphor-one-tile')).toHaveCount(allowed-1);
 await expect(page.locator('.adphor-one-more')).toHaveCount(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();
 expect(axe.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)}))).toEqual([]);
 await page.locator('.adphor-one-grid [data-page="mine"]').click();
 await expect(page.locator('.sidebar nav button[data-page="mine"]')).toHaveAttribute('aria-current','page');
 expect(await activateFullWidth(page)).toBe(true);
 await page.getByRole('button',{name:'Volver a la pantalla de inicio'}).click();
 expect(await activateFullWidth(page)).toBe(true);
 await expect(page.locator('.adphor-one-grid .adphor-one-tile')).toHaveCount(allowed-1);
});


test('ADPHOR ONE: balanced six-tool desktop rows without asymmetric oversized circles',async({page})=>{
 await page.setViewportSize({width:1440,height:900});
 await enterDemo(page);
 expect(await activateFullWidth(page)).toBe(true);
 const grid=page.locator('.adphor-one-group-grid');
 const counts=await grid.evaluateAll(elements=>elements.map(x=>x.querySelectorAll('.adphor-one-tile').length));
 expect(counts.slice(0,2)).toEqual([6,5]);
 for(let i=0;i<2;i++){
  const metrics=await grid.nth(i).locator('.adphor-one-tile').evaluateAll(nodes=>nodes.map(el=>{
    const box=el.getBoundingClientRect();
    const orb=el.querySelector('i').getBoundingClientRect();
    return {y:box.y,w:box.width,diameter:orb.width,height:box.height};
  }));
  expect(Math.max(...metrics.map(x=>x.y))-Math.min(...metrics.map(x=>x.y))).toBeLessThan(2);
  expect(Math.max(...metrics.map(x=>x.w))-Math.min(...metrics.map(x=>x.w))).toBeLessThan(2);
  expect(Math.max(...metrics.map(x=>x.diameter))).toBeLessThanOrEqual(80);
  expect(Math.max(...metrics.map(x=>x.height))-Math.min(...metrics.map(x=>x.height))).toBeLessThan(2);
 }
 const actual=await page.locator('.adphor-one-tile').evaluateAll(nodes=>nodes.map(x=>x.dataset.page));
 const authorized=await page.locator('.sidebar nav button[data-page]').evaluateAll(nodes=>nodes.map(x=>x.dataset.page));
 expect(new Set(actual)).toEqual(new Set(authorized.filter(id=>id!=='dashboard')));
});
test('ADPHOR ONE: responsive tablet and mobile keep regular circular columns',async({page})=>{
 await enterDemo(page);
 expect(await activateFullWidth(page)).toBe(true); // local E2E host is not the QA Integral hostname
 for(const width of [1024,768,390]){
  await page.setViewportSize({width,height:844});
  await expect(page.locator('.adphor-one-grid')).toBeVisible();
  const first=await page.locator('.adphor-one-group-grid').first().locator('.adphor-one-tile').evaluateAll(nodes=>nodes.map(n=>{
    const r=n.getBoundingClientRect(); return {x:Math.round(r.x),y:Math.round(r.y),w:r.width};
  }));
  const rows=[...new Set(first.map(x=>x.y))];
  expect(rows.length).toBe(width===390?3:2);
  expect(Math.max(...first.map(x=>x.w))-Math.min(...first.map(x=>x.w))).toBeLessThan(2);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 }
});

test('ADPHOR ONE: choosing a copropiedad still presents only the complete authorized launcher',async({page})=>{
 await enterDemo(page);
 expect(await activateFullWidth(page)).toBe(true);
 const select=page.locator('#project-select');
 const values=await select.locator('option').evaluateAll(nodes=>nodes.map(n=>n.value).filter(Boolean));
 expect(values.length).toBeGreaterThan(1);
 const current=await select.inputValue();
 const next=values.find(id=>id!==current);
 await select.selectOption(next);
 expect(await activateFullWidth(page)).toBe(true);
 await expect(page.locator('#page-content > .adphor-one-hero')).toBeVisible();
 await expect(page.locator('#page-content > .adphor-one-grid')).toBeVisible();
 await expect(page.locator('#page-content > *')).toHaveCount(2);
 await expect(page.locator('.dashboard-intro,.stats,.dashboard-grid,.recent-grid,.page-heading')).toHaveCount(0);
 const allowed=await page.locator('.sidebar nav button[data-page]').count();
 await expect(page.locator('.adphor-one-grid .adphor-one-tile')).toHaveCount(allowed-1);
 await expect(page.locator('.adphor-one-grid [data-page="meetings"]')).toBeVisible();
 await expect(page.locator('.adphor-one-grid [data-page="visits"]')).toBeVisible();
 await page.locator('.adphor-one-grid [data-page="visits"]').click();
 await expect(page.locator('.sidebar nav button[data-page="visits"]')).toHaveAttribute('aria-current','page');
});


test('ADPHOR ONE: centered, uniform rows at laptop, desktop and mobile sizes',async({page})=>{
 await enterDemo(page);
 expect(await activateFullWidth(page)).toBe(true);
 for(const [width,expectedDaily,expectedOperations] of [
  [1440,[6],[5]],
  [1024,[3,3],[3,2]],
  [768,[3,3],[3,2]],
  [390,[2,2,2],[2,2,1]]
 ]){
  await page.setViewportSize({width,height:900});
  const metrics=await page.locator('.adphor-one-group-grid').evaluateAll(groups=>groups.slice(0,2).map(group=>{
    const rect=group.getBoundingClientRect();
    const buttons=[...group.querySelectorAll('.adphor-one-tile')].map(el=>{
      const r=el.getBoundingClientRect();
      return {x:r.x,y:r.y,width:r.width,height:r.height};
    });
    const rows=[];
    for(const item of buttons){
      const row=rows.find(row=>Math.abs(row[0].y-item.y)<2);
      if(row)row.push(item);else rows.push([item]);
    }
    return {
      counts:rows.map(row=>row.length),
      widths:buttons.map(x=>x.width),
      rowCenters:rows.map(row=>(row[0].x+row.at(-1).x+row.at(-1).width)/2),
      gridCenter:rect.x+rect.width/2
    };
  }));
  expect(metrics[0].counts).toEqual(expectedDaily);
  expect(metrics[1].counts).toEqual(expectedOperations);
  for(const group of metrics){
    expect(Math.max(...group.widths)-Math.min(...group.widths)).toBeLessThan(2);
    for(const rowCenter of group.rowCenters)expect(Math.abs(rowCenter-group.gridCenter)).toBeLessThan(3);
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 }
 const allowed=await page.locator('.sidebar nav button[data-page]').evaluateAll(nodes=>nodes.map(n=>n.dataset.page).filter(x=>x!=='dashboard'));
 const tiles=await page.locator('.adphor-one-grid .adphor-one-tile').evaluateAll(nodes=>nodes.map(n=>n.dataset.page));
 expect(new Set(tiles)).toEqual(new Set(allowed));
});


test('ADPHOR ONE: Mis tareas is the first circle and opens the existing authorized task route',async({page})=>{
 await page.setViewportSize({width:1366,height:768});
 await enterDemo(page);
 expect(await activateFullWidth(page)).toBe(true);
 const daily=page.locator('.adphor-one-module-section').first();
 await expect(daily.locator('.adphor-one-module-heading')).toHaveText('Gestión diaria');
 await expect(daily.locator('.adphor-one-tile')).toHaveCount(6);
 await expect(daily.locator('.adphor-one-tile').first()).toHaveAttribute('data-page','mine');
 const second=page.locator('.adphor-one-module-section').nth(1);
 await expect(second.locator('.adphor-one-tile')).toHaveCount(5);
 await expect(second.locator('[data-page="recorridos"]')).toHaveCount(1);
 await expect(page.locator('.adphor-one-grid [data-page="mine"]')).toHaveCount(1);
 await daily.locator('[data-page="mine"]').click();
 await expect(page.locator('.sidebar nav button[data-page="mine"]')).toHaveAttribute('aria-current','page');
 await page.locator('.sidebar nav button[data-page="dashboard"]').click();
 expect(await activateFullWidth(page)).toBe(true);
 await expect(page.locator('.adphor-one-module-section').first().locator('.adphor-one-tile').first()).toHaveAttribute('data-page','mine');
 const allowed=await page.locator('.sidebar nav button[data-page]').evaluateAll(nodes=>nodes.map(node=>node.dataset.page).filter(id=>id!=='dashboard'));
 const displayed=await page.locator('.adphor-one-grid .adphor-one-tile').evaluateAll(nodes=>nodes.map(node=>node.dataset.page));
 expect(new Set(displayed)).toEqual(new Set(allowed));
});

test('la portada conserva el aviso IAM al reagrupar las herramientas', async ({page}) => {
  await enterDemo(page);
  await page.evaluate(() => {
    const notice = document.createElement('p');
    notice.className = 'qa-iam-readiness';
    notice.setAttribute('role', 'status');
    notice.textContent = 'Actualizar datos';
    document.querySelector('#page-content').prepend(notice);
  });
  await activateQaVisualInLocalTest(page);
  await expect(page.locator('#page-content .qa-iam-readiness')).toHaveText('Actualizar datos');
});
