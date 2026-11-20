import {test,expect} from '@playwright/test';

test('QA home puts operational commitments first and does not falsely deny PQRS radication',async({page})=>{
  const pageErrors=[];
  page.on('pageerror',error=>pageErrors.push(error.message));
  await page.setViewportSize({width:390,height:844});
  await page.goto('./');
  await page.locator('[name="profile"]').selectOption('admin-demo');
  await page.getByRole('button',{name:'Explorar demostración'}).click();

  const operational=page.getByRole('region',{name:'Agenda operativa de mis tareas'});
  await expect(operational).toBeVisible();
  await expect(operational.getByRole('heading',{name:'Mis compromisos por plazo'})).toBeVisible();
  await expect(operational).toContainText('no incluye aún actividades recurrentes');

  const appearsBeforeModules=await operational.evaluate(element=>{
    const modules=document.querySelector('.module-grid');
    return Boolean(modules&&(element.compareDocumentPosition(modules)&Node.DOCUMENT_POSITION_FOLLOWING));
  });
  expect(appearsBeforeModules).toBe(true);
  // Demo mode overlays service-derived case counts; the connected-QA copy is separately contract-tested.
  await expect(page.locator('.module-grid')).toContainText('Atención a la comunidad');
  await expect(page.locator('.module-grid')).not.toContainText('radicación real pendiente');
  expect(pageErrors).toEqual([]);
});
