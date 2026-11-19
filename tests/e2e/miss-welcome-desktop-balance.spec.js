import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';

for(const [width,height] of [[1440,900],[1200,800],[820,768]]){
 test('QA Integral: Miss ADPHOR video and login proportionate at '+width+'×'+height,async({page})=>{
  await page.setViewportSize({width,height});
  await page.goto('./');
  const source=await readFile(new URL('../../src/js/ui-miss-adphor-welcome.js',import.meta.url),'utf8');
  await page.route('**/__miss-welcome-desktop-e2e.js',route=>route.fulfill({
   status:200,contentType:'text/javascript',body:source
  }));
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
  expect(portrait.width).toBeLessThanOrEqual(232);
  expect(portrait.height).toBeLessThan(height*0.52);
  expect(portrait.height/portrait.width).toBeGreaterThan(1.70);
  expect(portrait.height/portrait.width).toBeLessThan(1.88);
  expect(login.x).toBeGreaterThan(story.x+story.width);
  expect(portrait.width).toBeLessThan(story.width*0.65);
  expect(login.width).toBeGreaterThanOrEqual(270);
  expect(login.y).toBeGreaterThanOrEqual(0);
  const firstInput=page.locator('#login-form input, #login-form select').first();
  await expect(firstInput).toBeVisible();
  const field=await firstInput.boundingBox();
  expect(field.y).toBeLessThan(height);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await expect(page.getByRole('button',{name:'Activar sonido de Miss ADPHOR'})).toBeVisible();
 });
}
