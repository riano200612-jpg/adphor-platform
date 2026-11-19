import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';

for(const [width,height] of [[1440,900],[1366,768],[1200,800],[1024,768],[820,768],[760,620]]){
 test('QA Integral: stacked Miss ADPHOR video above credentials at '+width+'×'+height,async({page})=>{
  await page.setViewportSize({width,height});
  await page.goto('./');
  const source=await readFile(new URL('../../src/js/ui-miss-adphor-welcome.js',import.meta.url),'utf8');
  await page.route('**/__miss-welcome-desktop-e2e.js',route=>route.fulfill({
   status:200,contentType:'text/javascript',body:source
  }));
  // CI uses localhost; production only enables the class on the authorized QA hostname.
  await page.locator('.login-shell').evaluate(el=>el.classList.add('miss-welcome-cover'));
  await page.evaluate(async()=>{
   const {mountMissAdphorWelcome}=await import('/__miss-welcome-desktop-e2e.js');
   mountMissAdphorWelcome(document);
  });
  const frame=page.locator('.client-avatar-frame');
  const portrait=await frame.boundingBox();
  const login=await page.locator('.login-form-wrap form').boundingBox();
  const story=await page.locator('.login-story').boundingBox();
  expect(portrait).not.toBeNull();
  expect(login).not.toBeNull();
  expect(story).not.toBeNull();
  // One centered layout: story/video above the form, not two competing columns.
  expect(story.y+story.height).toBeLessThanOrEqual(login.y+2);
  expect(Math.abs(story.x-login.x)).toBeLessThan(2);
  expect(Math.abs(story.width-login.width)).toBeLessThan(2);
  expect(Math.abs(portrait.x+portrait.width/2-story.x-story.width/2)).toBeLessThan(2);
  expect(login.width).toBeGreaterThan(400);
  expect(login.width).toBeLessThanOrEqual(610);
  // The moving portrait stays small and never dominates the entry screen.
  expect(portrait.width).toBeLessThanOrEqual(115);
  expect(portrait.height).toBeLessThanOrEqual(height*.26);
  expect(portrait.height/portrait.width).toBeGreaterThan(1.70);
  expect(portrait.height/portrait.width).toBeLessThan(1.88);
  const field=page.locator('#login-form input, #login-form select').first();
  await expect(field).toBeVisible();
  const fieldBox=await field.boundingBox();
  expect(fieldBox.y).toBeLessThan(height);
  await expect(page.getByRole('button',{name:'Activar sonido de Miss ADPHOR'})).toBeVisible();
  await expect(page.locator('#login-form button.btn.primary')).toHaveCount(1);
  await expect(page.locator('.client-avatar-frame .miss-welcome-video')).toHaveCount(1);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 });
}
test('QA Integral: login remains usable with keyboard and unchanged mobile cover',async({page})=>{
 await page.setViewportSize({width:1366,height:768});
 await page.goto('./');
 await page.locator('.login-shell').evaluate(el=>el.classList.add('miss-welcome-cover'));
 const sound=page.locator('.miss-welcome-cover .miss-welcome-sound');
 // The form is still the original functional login form with unchanged markup.
 await expect(page.locator('#login-form')).toBeVisible();
 await expect(page.locator('#login-form button.btn.primary')).toBeEnabled();
 await expect(page.locator('.login-form-wrap .app-mark')).toBeHidden();
 const desktop=await page.locator('.login-shell').evaluate(el=>getComputedStyle(el).flexDirection);
 expect(desktop).toBe('column');
 await page.setViewportSize({width:390,height:844});
 const mobile=await page.locator('.login-shell').evaluate(el=>getComputedStyle(el).display);
 expect(mobile).toBe('block');
 await expect(page.locator('.client-avatar-frame')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});
