import {test,expect} from '@playwright/test';

async function enter(page,profile){
  await page.goto('./');
  await page.locator('[name="profile"]').selectOption(profile);
  await page.getByRole('button',{name:'Explorar demostración'}).click();
}

test('admin can inspect team commitments within a property, without changing personal home',async({page})=>{
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.setViewportSize({width:390,height:844});
  await enter(page,'admin-demo');
  await page.getByRole('button',{name:'Registrar novedad',exact:true}).first().click();
  const form=page.locator('#new-case');
  await form.locator('[name="title"]').fill('Control R11 del equipo');
  await form.locator('[name="description"]').fill('Novedad sintética para supervisar asignaciones.');
  await form.locator('[name="location"]').fill('Área de demostración');
  await form.locator('[name="area"]').selectOption({index:1});
  await form.locator('[name="assignee"]').selectOption('tecnico');
  await form.getByRole('button',{name:'Guardar novedad'}).click();
  await expect(page.locator('dialog')).not.toBeVisible();

  await page.getByRole('button',{name:'Mis tareas',exact:true}).click();
  const personal=page.getByRole('region',{name:'Agenda operativa de mis tareas'});
  await expect(personal).toBeVisible();
  await expect(personal).not.toContainText('Control R11 del equipo');
  await personal.getByRole('button',{name:'Equipo de la copropiedad'}).click();

  const team=page.getByRole('region',{name:'Agenda operativa del equipo'});
  await expect(team.getByRole('heading',{name:'Compromisos del equipo por plazo'})).toBeVisible();
  await expect(team).toContainText('Control R11 del equipo');
  await expect(team.getByRole('button',{name:'Equipo de la copropiedad'})).toHaveAttribute('aria-pressed','true');
  const sprint=page.getByRole('region',{name:'Plan quincenal de trabajo'});
  await expect(sprint.getByRole('button',{name:'Equipo de la copropiedad'})).toHaveAttribute('aria-pressed','true');

  await team.locator('[data-ticket]').filter({hasText:'Control R11 del equipo'}).click();
  await expect(page.locator('dialog')).toContainText('Control R11 del equipo');
  await page.getByRole('button',{name:'Cerrar detalle'}).click();

  await page.getByRole('button',{name:'Resumen',exact:true}).click();
  const home=page.getByRole('region',{name:'Agenda operativa de mis tareas'});
  await expect(home).toBeVisible();
  await expect(home).not.toContainText('Control R11 del equipo');
  await expect(home.getByRole('button',{name:'Equipo de la copropiedad'})).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('viewer cannot access team agenda and prior admin scope clears on login change',async({page})=>{
  await enter(page,'admin-demo');
  await page.getByRole('button',{name:'Mis tareas',exact:true}).click();
  await page.getByRole('region',{name:'Agenda operativa de mis tareas'})
    .getByRole('button',{name:'Equipo de la copropiedad'}).click();
  await expect(page.getByRole('region',{name:'Agenda operativa del equipo'})).toBeVisible();
  await page.getByRole('button',{name:'Cerrar sesión',exact:true}).click();
  await page.locator('[name="profile"]').selectOption('viewer-demo');
  await page.getByRole('button',{name:'Explorar demostración'}).click();
  await page.getByRole('button',{name:'Mis tareas',exact:true}).click();
  const personal=page.getByRole('region',{name:'Agenda operativa de mis tareas'});
  await expect(personal).toBeVisible();
  await expect(personal.getByRole('button',{name:'Equipo de la copropiedad'})).toHaveCount(0);
  await expect(page.getByRole('region',{name:'Agenda operativa del equipo'})).toHaveCount(0);
});
