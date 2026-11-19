import {test,expect} from '@playwright/test';

async function login(page,profile){
 await page.goto('./');
 await page.locator('[name="profile"]').selectOption(profile);
 await page.getByRole('button',{name:'Explorar demostración'}).click();
 await expect(page.getByRole('heading',{name:'Todo tu mantenimiento, en un lugar.'})).toBeVisible();
}
test('agenda read-only: assigned task persists on reload and opens the original audited detail',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 const title='Agenda operativa verificable';
 await login(page,'admin-demo');
 await page.getByRole('button',{name:'Registrar novedad',exact:true}).first().click();
 const form=page.locator('#new-case');
 await form.locator('[name="title"]').fill(title);
 await form.locator('[name="description"]').fill('Caso sintético para verificar lectura persistente de la agenda.');
 await form.locator('[name="location"]').fill('Área de demostración');
 await form.locator('[name="area"]').selectOption({index:1});
 await form.locator('[name="assignee"]').selectOption('tecnico');
 await form.getByRole('button',{name:'Guardar novedad'}).click();
 await expect(page.locator('dialog')).not.toBeVisible();
 await page.getByRole('button',{name:'Cerrar sesión',exact:true}).click();
 await login(page,'tecnico');
 await page.getByRole('button',{name:'Mis tareas',exact:true}).click();
 const agenda=page.getByRole('region',{name:'Agenda operativa de mis tareas'});
 await expect(agenda).toBeVisible();
 await expect(agenda.locator('[data-operational-group="today"]')).toContainText(title);
 await agenda.locator('[data-operational-group="today"] button').filter({hasText:title}).click();
 await expect(page.locator('dialog')).toContainText(title);
 await page.getByRole('button',{name:'Cerrar detalle'}).click();
 await page.reload();
 await login(page,'tecnico');
 await expect(page.getByRole('region',{name:'Agenda operativa de mis tareas'})).toBeVisible();
 await expect(page.getByRole('region',{name:'Agenda operativa de mis tareas'})).toContainText(title);
 expect(errors).toEqual([]);
});

test('a viewer receives no task creation shortcut from operational agenda',async({page})=>{
 await login(page,'viewer-demo');
 const agenda=page.getByRole('region',{name:'Agenda operativa de mis tareas'});
 await expect(agenda).toBeVisible();
 await expect(agenda.getByRole('button',{name:'Registrar novedad'})).toHaveCount(0);
 await page.getByRole('button',{name:'Mis tareas',exact:true}).click();
 await expect(page.getByRole('region',{name:'Agenda operativa de mis tareas'})).toBeVisible();
});
