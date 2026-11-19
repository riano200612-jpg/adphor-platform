import {test,expect} from '@playwright/test';
async function enter(page,profile){
 await page.goto('./');
 await page.locator('[name="profile"]').selectOption(profile);
 await page.getByRole('button',{name:'Explorar demostración'}).click();
}
test('fortnight board shows persisted team ticket with role-specific scope and navigation',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await enter(page,'admin-demo');
 await page.getByRole('button',{name:'Registrar novedad',exact:true}).first().click();
 const form=page.locator('#new-case');
 await form.locator('[name="title"]').fill('Compromiso de sprint sintético');
 await form.locator('[name="description"]').fill('Prueba aislada de sprint.');
 await form.locator('[name="location"]').fill('Área de pruebas');
 await form.locator('[name="area"]').selectOption({index:1});
 await form.locator('[name="assignee"]').selectOption('tecnico');
 await form.getByRole('button',{name:'Guardar novedad'}).click();
 await page.getByRole('button',{name:'Mis tareas',exact:true}).click();
 const board=page.getByRole('region',{name:'Plan quincenal de trabajo'});
 await expect(board).toBeVisible();
 await expect(board.locator('[data-sprint-group="period"]')).not.toContainText('Compromiso de sprint sintético');
 await board.getByRole('button',{name:'Equipo de la copropiedad'}).click();
 await expect(board.locator('[data-sprint-group="period"]')).toContainText('Compromiso de sprint sintético');
 await board.getByRole('button',{name:'Período siguiente'}).click();
 await expect(board.locator('[data-sprint-group="carryover"]')).toContainText('Compromiso de sprint sintético');
 await board.getByRole('button',{name:'Período anterior'}).click();
 await board.getByRole('button',{name:'Mis asignaciones'}).click();
 await expect(board.locator('[data-sprint-group="period"]')).not.toContainText('Compromiso de sprint sintético');
 expect(errors).toEqual([]);
});
test('viewer cannot see team mode or write commands in sprint board',async({page})=>{
 await enter(page,'viewer-demo');
 await page.getByRole('button',{name:'Mis tareas',exact:true}).click();
 const board=page.getByRole('region',{name:'Plan quincenal de trabajo'});
 await expect(board).toBeVisible();
 await expect(board.getByRole('button',{name:'Equipo de la copropiedad'})).toHaveCount(0);
 await expect(board.getByRole('button',{name:'Registrar novedad'})).toHaveCount(0);
});

test('a new login resets previous admin-only team state',async({page})=>{
 await enter(page,'admin-demo');
 await page.getByRole('button',{name:'Mis tareas',exact:true}).click();
 const board=page.getByRole('region',{name:'Plan quincenal de trabajo'});
 await board.getByRole('button',{name:'Equipo de la copropiedad'}).click();
 await expect(board.getByRole('button',{name:'Equipo de la copropiedad'})).toHaveAttribute('aria-pressed','true');
 await page.getByRole('button',{name:'Cerrar sesión',exact:true}).click();
 await page.locator('[name="profile"]').selectOption('tecnico');
 await page.getByRole('button',{name:'Explorar demostración'}).click();
 await page.getByRole('button',{name:'Mis tareas',exact:true}).click();
 await expect(board).toBeVisible();
 await expect(board.getByRole('button',{name:'Equipo de la copropiedad'})).toHaveCount(0);
 await expect(board).toContainText('Vista de tus propias asignaciones');
});
