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
const centerY=(r)=>r.y+r.height/2;

for(const [width,height] of [[1440,900],[1366,768],[1200,800],[1024,768],[920,700],[840,620]]){
 test('QA Integral: medium Miss ADPHOR video beside balanced credential form at '+width+'×'+height,async({page})=>{
  await page.setViewportSize({width,height});
  await page.goto('./');
  await enableQaWelcomeOnLocalHost(page);
  const story=await page.locator('.login-story').boundingBox();
  const portrait=await page.locator('.client-avatar-frame').boundingBox();
  const form=await page.locator('.login-form-wrap form').boundingBox();
  const panel=await page.locator('.login-form-wrap').boundingBox();
  for(const box of [story,portrait,form,panel]) expect(box).not.toBeNull();
  // First impression: two clear and aligned panels, not a full-screen video or a thumbnail.
  expect(story.x+story.width).toBeLessThan(panel.x);
  expect(Math.abs(story.y-panel.y)).toBeLessThan(2);
  expect(Math.abs(story.height-panel.height)).toBeLessThan(2);
  expect(story.width).toBeGreaterThanOrEqual(260);
  expect(panel.width).toBeGreaterThanOrEqual(350);
  expect(story.width/panel.width).toBeGreaterThan(.52);
  expect(story.width/panel.width).toBeLessThan(.76);
  expect(Math.abs(centerY(story)-centerY(portrait))).toBeLessThan(75);
  expect(portrait.width).toBeGreaterThanOrEqual(195);
  expect(portrait.width).toBeLessThanOrEqual(310);
  expect(portrait.height/portrait.width).toBeGreaterThan(1.70);
  expect(portrait.height/portrait.width).toBeLessThan(1.88);
  expect(portrait.height).toBeLessThan(height*.69);
  await expect(page.locator('.login-story > .brand')).toBeHidden();
  // Miss herself fills most of the narrowed presentation card.
  expect(portrait.width/story.width).toBeGreaterThan(.66);
  expect(portrait.height/story.height).toBeGreaterThan(.68);
  expect(story.width).toBeLessThan(panel.width);
  await expect(page.locator('#login-form')).toBeVisible();
  await expect(page.locator('#login-form button.btn.primary')).toBeEnabled();
  await expect(page.getByRole('button',{name:'Activar sonido de Miss ADPHOR'})).toBeVisible();
  await expect(page.locator('.client-avatar-frame .miss-welcome-video')).toHaveCount(1);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  const submit=page.locator('#login-form button.btn.primary');
  await submit.scrollIntoViewIfNeeded();
  const submitBox=await submit.boundingBox();
  expect(submitBox.y+submitBox.height).toBeLessThanOrEqual(height+2);
 });
}

for(const [width,height] of [[820,768],[760,620],[600,800]]){
 test('QA Integral: narrow tablet uses an accessible compact stacked layout at '+width+'×'+height,async({page})=>{
  await page.setViewportSize({width,height});
  await page.goto('./');
  await enableQaWelcomeOnLocalHost(page);
  const story=await page.locator('.login-story').boundingBox();
  const panel=await page.locator('.login-form-wrap').boundingBox();
  const portrait=await page.locator('.client-avatar-frame').boundingBox();
  expect(story.y+story.height).toBeLessThanOrEqual(panel.y+2);
  expect(Math.abs(story.x-panel.x)).toBeLessThan(2);
  expect(Math.abs(story.width-panel.width)).toBeLessThan(2);
  expect(portrait.width).toBeGreaterThanOrEqual(85);
  expect(portrait.width).toBeLessThanOrEqual(155);
  await expect(page.locator('#login-form button.btn.primary')).toBeEnabled();
  await expect(page.locator('.login-story > .brand')).toBeHidden();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 });
}

test('QA Integral: desktop login keeps keyboard navigation, semantic labels and WCAG',async({page})=>{
 await page.setViewportSize({width:1366,height:768});
 await page.goto('./');
 await enableQaWelcomeOnLocalHost(page);
 const accessibility=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();
 expect(accessibility.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)}))).toEqual([]);
 const submit=page.locator('#login-form button.btn.primary');
 await submit.focus();
 await expect(submit).toBeFocused();
 await expect(page.locator('#login-form label')).not.toHaveCount(0);
});

test('QA Integral: the original mobile login presentation is not modified',async({page})=>{
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
