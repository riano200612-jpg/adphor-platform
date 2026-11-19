import {test,expect} from '@playwright/test';

async function enter(page,profile='admin-demo'){
 await page.goto('./');
 await page.locator('[name="profile"]').selectOption(profile);
 await page.getByRole('button',{name:'Explorar demostración'}).click();
 await page.getByRole('button',{name:'Mis tareas',exact:true}).click();
}

test('Mis tareas: easy form lists project areas, readable controls and safe defaults',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await enter(page);
 await page.getByRole('button',{name:'Registrar novedad',exact:true}).first().click();
 const form=page.locator('#new-case');
 await expect(form).toBeVisible();
 await expect(form.getByText('¿Qué sucedió?')).toBeVisible();
 await expect(form.getByText('¿Quién lo atiende y para cuándo?')).toBeVisible();
 await expect(form.locator('[name=area] option')).toHaveCount(6);
 await expect(form.locator('[name=priority]')).toHaveValue('Media');
 await expect(form.locator('[name=assignee]')).toHaveValue('admin-demo');
 await expect(form.locator('[name=due_date]')).not.toHaveValue('');
 await expect(form.getByText('Añadir fotos (opcional)')).toBeVisible();
 const dimensions=await form.locator('[name=title],[name=area],[name=assignee]').evaluateAll(nodes=>nodes.map(n=>({height:n.getBoundingClientRect().height,font:parseFloat(getComputedStyle(n).fontSize)})));
 for(const v of dimensions){expect(v.height).toBeGreaterThanOrEqual(48);expect(v.font).toBeGreaterThanOrEqual(16);}
 expect(errors).toEqual([]);
});

test('inline validation identifies missing area without erasing the entered text',async({page})=>{
 await enter(page);
 await page.getByRole('button',{name:'Registrar novedad',exact:true}).first().click();
 const form=page.locator('#new-case');
 await form.locator('[name=title]').fill('Reparación del pasillo');
 await form.locator('[name=location]').fill('Pasillo primer piso');
 await form.locator('[name=description]').fill('Una lámpara necesita reparación.');
 await form.getByRole('button',{name:'Guardar novedad'}).click();
 await expect(form.locator('.simple-form-error')).toContainText('Selecciona un área');
 await expect(form.locator('[name=area]')).toHaveAttribute('aria-invalid','true');
 await expect(form.locator('[name=area]')).toBeFocused();
 await expect(form.locator('[name=title]')).toHaveValue('Reparación del pasillo');
 await form.locator('[name=area]').selectOption({index:1});
 await form.getByRole('button',{name:'Guardar novedad'}).click();
 await expect(page.locator('dialog')).not.toBeVisible();
});

test('mobile technician sees area choices, own task only and no horizontal overflow',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await enter(page,'tecnico');
 await page.getByRole('button',{name:'Registrar novedad',exact:true}).first().click();
 const form=page.locator('#new-case');
 await expect(form.locator('[name=area] option')).toHaveCount(6);
 await expect(form.locator('[name=assignee]')).toBeDisabled();
 await expect(form.locator('[name=assignee]')).toHaveValue('tecnico');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth)).toBeLessThanOrEqual(2);
 await form.getByRole('button',{name:'Cancelar'}).click();
 await page.getByRole('button',{name:'Cerrar sesión',exact:true}).click();
 await page.locator('[name=profile]').selectOption('viewer-demo');
 await page.getByRole('button',{name:'Explorar demostración'}).click();
 await page.getByRole('button',{name:'Mis tareas',exact:true}).click();
 await expect(page.getByRole('button',{name:'Registrar novedad',exact:true})).toHaveCount(0);
});
