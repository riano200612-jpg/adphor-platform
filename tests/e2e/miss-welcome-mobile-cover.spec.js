import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';

async function enableWelcome(page){
  const source=await readFile(new URL('../../src/js/ui-miss-adphor-welcome.js',import.meta.url),'utf8');
  await page.route('**/__miss-welcome-e2e.js',route=>route.fulfill({status:200,contentType:'text/javascript',body:source}));
  await page.locator('.login-shell').evaluate(el=>el.classList.add('miss-welcome-cover'));
  await page.evaluate(async()=>{
    const {mountMissAdphorWelcome}=await import('/__miss-welcome-e2e.js');
    mountMissAdphorWelcome(document);
  });
}

test('QA Integral mobile starts with Miss ADPHOR and two functional entry choices',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('./');
  await enableWelcome(page);
  const cover=page.locator('.login-shell');
  const portrait=page.locator('.client-avatar-frame');
  await expect(cover).toHaveClass(/miss-entry-is-cover/);
  await expect(portrait).toBeVisible();
  await expect(page.getByRole('button',{name:'Primera vez'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Ingresar al portal'})).toBeVisible();
  await expect(page.locator('#login-form')).toBeHidden();
  const frameBox=await portrait.boundingBox();
  expect(frameBox.width).toBeGreaterThan(200);
  expect(frameBox.height).toBeLessThan(844*0.65);
  expect((await page.getByRole('button',{name:'Ingresar al portal'}).boundingBox()).y).toBeLessThan(844);
  await expect(page.getByRole('button',{name:'Activar sonido de Miss ADPHOR'})).toBeVisible();

  await page.getByRole('button',{name:'Primera vez'}).click();
  const tutorial=page.getByRole('dialog',{name:'Guía de primer ingreso de Miss ADPHOR'});
  await expect(tutorial).toBeVisible();
  await expect(tutorial.getByText('Video tutorial de ADPHOR')).toBeVisible();
  await expect(tutorial.getByText(/se incorporará aquí más adelante/)).toBeVisible();
  await expect(page.locator('#login-form')).toBeHidden();
  await tutorial.getByRole('button',{name:'Continuar al ingreso'}).click();

  await expect(tutorial).toBeHidden();
  await expect(cover).toHaveClass(/miss-entry-is-login/);
  await expect(page.locator('.login-story')).toBeHidden();
  await expect(page.locator('#login-form')).toBeVisible();
  await expect(page.locator('.miss-qa-corporate-identity img')).toBeVisible();
  await expect(page.locator('#login-form button.btn.primary')).toBeEnabled();
  const firstInput=page.locator('#login-form input[name="email"], #login-form select[name="profile"]').first();
  await expect(firstInput).toBeVisible();
  expect((await firstInput.boundingBox()).y).toBeLessThan(844);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);

  await page.getByRole('button',{name:'Volver a la portada'}).click();
  await expect(cover).toHaveClass(/miss-entry-is-cover/);
  await expect(page.locator('#login-form')).toBeHidden();
});

test('narrow Android starts with choices and reveals form with original logo without overflow',async({page})=>{
  await page.setViewportSize({width:360,height:740});
  await page.goto('./');
  await enableWelcome(page);
  await expect(page.locator('#login-form')).toBeHidden();
  const stage=await page.locator('.client-avatar-frame').boundingBox();
  expect(stage.width).toBeGreaterThan(200);
  expect(stage.height).toBeLessThan(740*0.65);
  await page.getByRole('button',{name:'Ingresar al portal'}).click();
  await expect(page.locator('#login-form')).toBeVisible();
  await expect(page.locator('.miss-qa-corporate-identity img')).toBeVisible();
  const field=await page.locator('#login-form input, #login-form select').first().boundingBox();
  expect(field.y).toBeLessThan(740);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1)).toBe(false);
});
