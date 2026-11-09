import {test,expect} from '@playwright/test';
test('recovered Miss ADPHOR login guidance stays local and never confirms actions',async({page})=>{
 await page.goto('./');
 const toggle=page.getByRole('button',{name:/Conversar con Miss ADPHOR/});
 await expect(toggle).toHaveAttribute('aria-expanded','false');
 await toggle.click();
 await expect(page.getByText('Orientación local de acceso.',{exact:false})).toBeVisible();
 await page.getByLabel('Tu pregunta').fill('¿Cómo agendo una reunión?');
 await page.getByRole('button',{name:'Preguntar',exact:true}).click();
 await expect(page.locator('#miss-login-answer')).toContainText('Google Calendar debe verificarse');
 await page.getByRole('button',{name:'PQRS',exact:true}).click();
 await expect(page.locator('#miss-login-answer')).toContainText('no confirmo radicaciones');
 await expect(page.getByRole('button',{name:'Explorar demostración'})).toBeVisible();
});
