import {test,expect} from '@playwright/test';

test('first MFA registration requires an explicit action and displays no verification input yet',async({page})=>{
 await page.goto('./');
 await page.evaluate(async()=>{
  const {renderMfaScreen}=await import('/adphor-platform/src/js/ui-mfa.js');
  const host=document.createElement('div');host.id='mfa-fixture';document.body.replaceChildren(host);
  renderMfaScreen(host,true);
 });
 await expect(page.getByRole('button',{name:'Registrar autenticador'})).toBeVisible();
 await expect(page.locator('input[name=code]')).toBeDisabled();
 await expect(page.getByRole('button',{name:'Volver al acceso'})).toBeVisible();
});
test('MFA enrollment displays a QR as an image and manual secret as text',async({page})=>{
 await page.goto('./');
 await page.evaluate(async()=>{
  const {renderMfaScreen}=await import('/adphor-platform/src/js/ui-mfa.js');
  const host=document.createElement('div');document.body.replaceChildren(host);
  renderMfaScreen(host,true,{qrCode:'<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>',secret:'<img src=x onerror="window.injected=true">'});
 });
 await expect(page.getByRole('img',{name:/Código QR privado/})).toBeVisible();
 await expect(page.locator('input[name=code]')).toBeEnabled();
 await page.getByText('Configurar manualmente').click();
 await expect(page.locator('details code')).toHaveText('<img src=x onerror="window.injected=true">');
 expect(await page.evaluate(()=>window.injected)).toBeUndefined();
 await expect(page.getByRole('button',{name:'Verificar',exact:true})).toBeVisible();
});
