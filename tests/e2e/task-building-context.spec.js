import {test,expect} from '@playwright/test';

test('Mis tareas: registrar novedad identifica la copropiedad activa en móvil y conserva los campos',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 const errors=[];page.on('pageerror',err=>errors.push(err.message));
 await page.goto('./');
 await page.locator('[name="profile"]').selectOption('admin-demo');
 await page.getByRole('button',{name:'Explorar demostración'}).click();
 await page.getByRole('button',{name:'Mis tareas',exact:true}).click();
 const projectName=(await page.locator('.page-heading .eyebrow').first().textContent())?.trim();
 expect(projectName).toBeTruthy();
 await page.getByRole('button',{name:'Registrar novedad',exact:true}).first().click();
 const form=page.locator('#new-case');
 await expect(form).toBeVisible();
 await expect(form.locator('[data-active-building]')).toHaveText('Estás trabajando en: '+projectName);
 await expect(form.locator('[name=title]')).toBeVisible();
 await expect(form.locator('[name=assignee]')).toBeVisible();
 await expect(form.getByRole('button',{name:'Guardar novedad'})).toBeVisible();
 const font=await form.locator('[data-active-building]').evaluate(node=>parseFloat(getComputedStyle(node).fontSize));
 const rootFont=await page.evaluate(()=>parseFloat(getComputedStyle(document.documentElement).fontSize));
 expect(rootFont).toBe(14);
 expect(font).toBeGreaterThanOrEqual(18);
 expect(errors).toEqual([]);
});
