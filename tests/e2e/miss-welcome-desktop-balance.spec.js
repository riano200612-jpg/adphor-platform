import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';

async function enableQaWelcomeOnLocalHost(page) {
  const source=await readFile(new URL('../../src/js/ui-miss-adphor-welcome.js',import.meta.url),'utf8');
  await page.route('**/__miss-welcome-desktop-e2e.js',route=>route.fulfill({
    status:200,contentType:'text/javascript',body:source
  }));
  await page.locator('.login-shell').evaluate(el=>el.classList.add('miss-welcome-cover'));
  await page.evaluate(async()=>{
    const {mountMissAdphorWelcome}=await import('/__miss-welcome-desktop-e2e.js');
    mountMissAdphorWelcome(document);
  });
}

for (const [width,height] of [[1440,900],[1366,768],[1200,800],[1024,768],[820,768],[760,620]]) {
  test('QA Integral: aligned centered welcome and login at '+width+'×'+height,async({page})=>{
    await page.setViewportSize({width,height});
    await page.goto('./');
    await enableQaWelcomeOnLocalHost(page);
    const story=await page.locator('.login-story').boundingBox();
    const brand=await page.locator('.login-story > .brand').boundingBox();
    const portrait=await page.locator('.client-avatar-frame').boundingBox();
    const form=await page.locator('.login-form-wrap form').boundingBox();
    expect(story).not.toBeNull();
    expect(brand).not.toBeNull();
    expect(portrait).not.toBeNull();
    expect(form).not.toBeNull();
    // Consistent horizontal axis for every important visual element.
    const midpoint=(r)=>r.x+r.width/2;
    expect(Math.abs(midpoint(story)-midpoint(form))).toBeLessThan(2);
    expect(Math.abs(midpoint(story)-midpoint(brand))).toBeLessThan(2);
    expect(Math.abs(midpoint(story)-midpoint(portrait))).toBeLessThan(2);
    expect(Math.abs(story.width-form.width)).toBeLessThan(2);
    expect(story.y+story.height).toBeLessThanOrEqual(form.y+2);
    expect(brand.y+brand.height).toBeLessThan(portrait.y);
    // A compact, balanced composition rather than broad banner + tiny video.
    expect(form.width).toBeGreaterThanOrEqual(430);
    expect(form.width).toBeLessThanOrEqual(530);
    expect(portrait.width).toBeGreaterThanOrEqual(75);
    expect(portrait.width).toBeLessThanOrEqual(102);
    expect(portrait.height/portrait.width).toBeGreaterThan(1.70);
    expect(portrait.height/portrait.width).toBeLessThan(1.88);
    const loginButton=page.locator('#login-form button.btn.primary');
    await expect(loginButton).toHaveCount(1);
    await expect(loginButton).toBeEnabled();
    await expect(page.locator('#login-form input, #login-form select').first()).toBeVisible();
    await expect(page.locator('.client-avatar-frame .miss-welcome-video')).toHaveCount(1);
    await expect(page.getByRole('button',{name:'Activar sonido de Miss ADPHOR'})).toBeVisible();
    // On a short monitor it is acceptable to scroll vertically, never sideways.
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    // Required login actions must be reachable, never clipped under an overlay.
    await loginButton.scrollIntoViewIfNeeded();
    const button=await loginButton.boundingBox();
    expect(button.y+button.height).toBeLessThanOrEqual(height+2);
  });
}
test('QA Integral desktop welcome remains usable with keyboard and supports WCAG',async({page})=>{
  await page.setViewportSize({width:1366,height:768});
  await page.goto('./');
  await enableQaWelcomeOnLocalHost(page);
  const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();
  expect(result.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)}))).toEqual([]);
  const submit=page.locator('#login-form button.btn.primary');
  await submit.focus();
  await expect(submit).toBeFocused();
});
test('QA Integral mobile portrait layout remains unchanged',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('./');
  await page.locator('.login-shell').evaluate(el=>el.classList.add('miss-welcome-cover'));
  await expect(page.locator('.login-shell')).toHaveCSS('display','block');
  const portrait=await page.locator('.client-avatar-frame').boundingBox();
  expect(portrait.width).toBeGreaterThan(225);
  expect(portrait.width).toBeLessThan(330);
  expect(portrait.height/portrait.width).toBeGreaterThan(1.53);
  expect(portrait.height/portrait.width).toBeLessThan(1.60);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});
