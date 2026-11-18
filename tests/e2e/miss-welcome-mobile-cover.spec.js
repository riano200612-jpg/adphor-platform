import {test,expect} from '@playwright/test';

test.use({viewport:{width:390,height:844}});

test('QA Integral cover shows a full-height Miss ADPHOR portrait with one overlaid sound icon',async({page})=>{
  await page.goto('./');
  // Emulate the QA-only visual state on the local E2E host, without
  // changing the production hostname allowlist or Cloudflare Access.
  await page.locator('.login-shell').evaluate(el=>el.classList.add('miss-welcome-cover'));
  await page.evaluate(async()=>{
    const {mountMissAdphorWelcome}=await import('/src/js/ui-miss-adphor-welcome.js');
    mountMissAdphorWelcome(document);
  });

  const frame=page.locator('.client-avatar-frame');
  const sound=page.getByRole('button',{name:'Activar sonido de Miss ADPHOR'});
  await expect(frame).toBeVisible();
  await expect(sound).toBeVisible();
  await expect(page.getByRole('button',{name:/Conversar con Miss ADPHOR/})).toBeHidden();
  await expect(page.locator('.login-story h1')).toBeHidden();
  await expect(page.locator('.login-form-wrap form')).toBeVisible();

  const stage=await frame.boundingBox();
  const button=await sound.boundingBox();
  expect(stage).not.toBeNull();
  expect(button).not.toBeNull();
  expect(stage.width).toBeGreaterThan(260);
  expect(stage.height/stage.width).toBeGreaterThan(1.65);
  expect(button.x).toBeGreaterThan(stage.x+stage.width/2);
  expect(button.y).toBeGreaterThan(stage.y+stage.height/2);
  expect(button.width).toBeGreaterThanOrEqual(44);
  await expect(frame.locator('.miss-welcome-controls button')).toHaveCount(1);

  // The login must remain operable independently of multimedia.
  await expect(page.locator('#login-form')).toBeVisible();
  await expect(page.locator('#login-form button[type=submit], #login-form button.btn.primary')).toHaveCount(1);
});
