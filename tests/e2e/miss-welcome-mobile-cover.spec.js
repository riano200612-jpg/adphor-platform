import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';

test.use({viewport:{width:390,height:844}});

test('QA Integral cover balances Miss ADPHOR portrait and login in a mobile viewport',async({page})=>{
  await page.goto('./');
  // Emulate the QA-only visual state on the local E2E host, without
  // changing the production hostname allowlist or Cloudflare Access.
  // CI runs a compiled static site on :8000; serve the unmodified module
  // through a same-origin test-only route to exercise the actual player code.
  const source=await readFile(new URL('../../src/js/ui-miss-adphor-welcome.js',import.meta.url),'utf8');
  await page.route('**/__miss-welcome-e2e.js',route=>route.fulfill({status:200,contentType:'text/javascript',body:source}));
  await page.locator('.login-shell').evaluate(el=>el.classList.add('miss-welcome-cover'));
  await page.evaluate(async()=>{
    const {mountMissAdphorWelcome}=await import('/__miss-welcome-e2e.js');
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
  // Intermediate size: significantly larger than the old thumbnail,
  // smaller than the nearly full-screen video, without stretching the face.
  expect(stage.width).toBeGreaterThan(225);
  expect(stage.width).toBeLessThan(330);
  expect(stage.height/stage.width).toBeGreaterThan(1.53);
  expect(stage.height/stage.width).toBeLessThan(1.60);
  expect(stage.height).toBeLessThan(844*0.50);
  expect(button.x).toBeGreaterThan(stage.x+stage.width/2);
  expect(button.y).toBeGreaterThan(stage.y+stage.height/2);
  expect(button.width).toBeGreaterThanOrEqual(44);
  await expect(frame.locator('.miss-welcome-controls button')).toHaveCount(1);

  // The palette is exclusive to QA Integral: blue-night gradients and
  // champagne-gold edging, without image filters or a second toolbar.
  const palette=await page.evaluate(()=>{
    const story=getComputedStyle(document.querySelector('.miss-welcome-cover .login-story'));
    const stage=getComputedStyle(document.querySelector('.miss-welcome-cover .client-avatar-frame'));
    const speaker=getComputedStyle(document.querySelector('.miss-welcome-cover .miss-welcome-sound'));
    const portrait=getComputedStyle(document.querySelector('.miss-welcome-cover .client-avatar-image'));
    return {
      background:story.backgroundImage,
      storyBorder:story.borderTopWidth,
      stageBackground:stage.backgroundImage,
      stageBorder:stage.borderTopWidth,
      stageShadow:stage.boxShadow,
      speakerBackground:speaker.backgroundImage,
      speakerBorder:speaker.borderTopStyle,
      portraitFilter:portrait.filter
    };
  });
  expect(palette.background).toContain('radial-gradient');
  expect(palette.background).toContain('linear-gradient');
  expect(palette.storyBorder).toBe('1px');
  expect(palette.stageBackground).toContain('linear-gradient');
  expect(palette.stageBorder).toBe('2px');
  expect(palette.stageShadow).not.toBe('none');
  expect(palette.speakerBackground).toContain('linear-gradient');
  expect(palette.speakerBorder).toBe('solid');
  expect(palette.portraitFilter).toBe('none');

  // The first screen must show the start of the login below the cover.
  const login=page.locator('#login-form');
  await expect(login).toBeVisible();
  const loginBox=await login.boundingBox();
  expect(loginBox).not.toBeNull();
  expect(loginBox.y).toBeGreaterThan(stage.y+stage.height);
  expect(loginBox.y).toBeLessThan(844*0.72);
  const firstField=page.locator('#login-form input, #login-form select').first();
  await expect(firstField).toBeVisible();
  const fieldBox=await firstField.boundingBox();
  expect(fieldBox.y).toBeLessThan(844);
  await expect(page.locator('#login-form button[type=submit], #login-form button.btn.primary')).toHaveCount(1);
});

test('narrow Android cover keeps the entry field visible without horizontal overflow',async({page})=>{
  await page.setViewportSize({width:360,height:740});
  await page.goto('./');
  await page.locator('.login-shell').evaluate(el=>el.classList.add('miss-welcome-cover'));
  const stage=await page.locator('.client-avatar-frame').boundingBox();
  const field=await page.locator('#login-form input, #login-form select').first().boundingBox();
  expect(stage).not.toBeNull();
  expect(stage.height).toBeLessThan(740*0.50);
  expect(stage.width).toBeGreaterThan(200);
  expect(field).not.toBeNull();
  expect(field.y).toBeLessThan(740);
  const horizontalOverflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1);
  expect(horizontalOverflow).toBe(false);
});
