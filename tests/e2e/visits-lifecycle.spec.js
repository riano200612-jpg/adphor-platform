import {test,expect} from '../../qa/isolated-browser-test.js';
import {createVisitFixture,visitSqlClient,visitUsers} from '../../qa/visit-lifecycle-fixture.js';
import {createSharedVisitRepository} from '../../src/js/services/shared-visits.js';

test('Visitas SQL aislado: programación, reintentos, edición, ingreso, resultados, salida, historial y recarga',async({page,baseURL},testInfo)=>{
 test.setTimeout(60000);
 const f=await createVisitFixture();
 try{
  const repository=createSharedVisitRepository(visitSqlClient(f),{url:'https://qfctnnnnltghepwujpdm.supabase.co',writesEnabled:true,lifecycleEnabled:true});
  let loseCreate=true,loseStart=true,createCalls=0;
  await page.exposeFunction('visitsSave',async value=>{
   createCalls++;const result=await repository.save(value);
   if(loseCreate){loseCreate=false;throw Error('Synthetic lost response after COMMIT');}return result;
  });
  await page.exposeFunction('visitsList',value=>repository.list(value));
  await page.exposeFunction('visitsTransition',async value=>{
   const result=await repository.transition(value);
   if(value.action==='start'&&loseStart){loseStart=false;throw Error('Synthetic lost response after COMMIT');}return result;
  });
  await page.exposeFunction('visitsHistory',(project,id)=>repository.history(project,id));
  const moduleUrl=new URL('src/js/ui-visit-preparation.js',baseURL).href;
  await page.route('**/visits-lifecycle-fixture',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="${new URL('src/css/visits.css',baseURL)}"><div id="visit"></div><script type="module">
   import {mountVisitPreparation} from '${moduleUrl}';
   mountVisitPreparation(document.querySelector('#visit'),{projectId:'p1',projectName:'Copropiedad sintética aislada',members:[{project_id:'p1',user_id:'${visitUsers.admin}',name:'Administrador de prueba'},{project_id:'p1',user_id:'${visitUsers.coord}',name:'Coordinador de prueba'},{project_id:'p2',user_id:'${visitUsers.other}',name:'Ajeno'}],visitRepository:{lifecycleEnabled:true,save:window.visitsSave,list:window.visitsList,transition:window.visitsTransition,history:window.visitsHistory},canCreate:true});
  </script>`}));
  await page.goto('./visits-lifecycle-fixture');
  await expect(page.getByRole('heading',{name:'Visitas',exact:true})).toBeVisible();
  await page.getByLabel('Tipo o motivo').fill('Inspección sintética');
  await page.getByLabel('Fecha y hora (Colombia)',{exact:true}).fill('2026-11-14T10:00');
  await page.locator('select[name=responsible]').selectOption(visitUsers.admin);
  await expect(page.locator('select[name=responsible] option')).toHaveCount(3);
  await page.getByRole('button',{name:'Revisar visita',exact:true}).click();
  const save=page.getByRole('button',{name:'Confirmar y registrar visita'});
  await save.click();await expect(page.getByText('No se pudo confirmar el guardado. Reintenta con el mismo borrador.')).toBeVisible();
  // Two synchronous clicks simulate an accidental repeat while a request is pending.
  await save.evaluate(button=>{button.click();button.click();});
  await expect(page.locator('[data-visit-results] > li')).toHaveCount(1);
  expect(createCalls).toBe(2);
  await page.reload();
  await page.getByText('Seguimiento · Programada',{exact:true}).click();
  await page.getByLabel('Editar motivo').fill('Inspección ajustada');
  await page.getByLabel('Editar responsable').selectOption(visitUsers.coord);
  await page.getByRole('button',{name:'Guardar cambios'}).click();
  await expect(page.locator('[data-visit-results] > li > strong')).toHaveText('Inspección ajustada');
  await page.getByText('Seguimiento · Programada',{exact:true}).click();
  await page.getByRole('button',{name:'Registrar ingreso'}).click();
  await expect(page.getByText('No se pudo confirmar la operación.',{exact:false})).toBeVisible();
  await page.getByRole('button',{name:'Registrar ingreso'}).click();
  await page.getByText('Seguimiento · En ejecución',{exact:true}).click();
  await expect(page.getByLabel('Editar motivo')).toHaveCount(0);
  await page.getByLabel('Observaciones',{exact:true}).fill('Zona inspeccionada');
  await page.getByLabel('Actividades realizadas').fill('Revisión de iluminación');
  await page.getByLabel('Compromisos y seguimiento').fill('Programar mantenimiento');
  await page.getByRole('button',{name:'Registrar salida y completar'}).click();
  await expect(page.getByText('Completa los datos requeridos de la visita.')).toBeVisible();
  await page.getByLabel('Conclusiones',{exact:true}).fill('Inspección completa');
  await page.getByRole('button',{name:'Guardar seguimiento'}).click();
  await page.getByText('Seguimiento · En ejecución',{exact:true}).click();
  await expect(page.getByLabel('Compromisos y seguimiento')).toHaveValue('Programar mantenimiento');
  await page.getByRole('button',{name:'Registrar salida y completar'}).click();
  await page.reload();await page.getByText('Seguimiento · Completada',{exact:true}).click();
  await expect(page.getByLabel('Conclusiones',{exact:true})).toHaveValue('Inspección completa');
  await expect(page.getByRole('button',{name:'Registrar ingreso'})).toHaveCount(0);
  await page.getByRole('button',{name:'Consultar historial'}).click();
  await expect(page.locator('[data-visit-results] ol > li')).toHaveCount(5);
  const saved=await repository.list('p1');expect(saved).toHaveLength(1);expect(saved[0].version).toBe(5);
  await page.screenshot({path:testInfo.outputPath('visitas-completada-desktop.png'),fullPage:true});
  await page.setViewportSize({width:390,height:850});
  expect(await page.locator('body').evaluate(x=>x.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({path:testInfo.outputPath('visitas-completada-mobile.png'),fullPage:true});
 }finally{await f.db.close();}
});
