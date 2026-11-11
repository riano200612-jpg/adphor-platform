import {test,expect} from '../../qa/isolated-browser-test.js';
test('agenda reader scopes real UI, filters Bogotá dates and keeps query errors distinct',async({page,baseURL},testInfo)=>{
 let failed=false;
 await page.exposeFunction('loadAgendaFixture',async()=>{
  if(failed)throw Error('Fixture query failed');
  const row={id:'synthetic-meeting',project_id:'p1',title:'Consejo QA aislado',kind:'Consejo',source_status:'Confirmada',start_at:'2026-11-12T02:00:00Z',end_at:'2026-11-12T03:00:00Z',is_calendar_verified:true};
  return [row,{...row,id:'foreign',project_id:'p2',title:'No autorizada'}];
 });
 const fixture=new URL('agenda-reader-fixture',baseURL).href;
 const moduleUrl=new URL('src/js/ui-verified-agenda.js',baseURL).href;
 await page.route('**/agenda-reader-fixture',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><html lang="es"><meta name="viewport" content="width=device-width,initial-scale=1"><main id="agenda"></main><script type="module">import {mountVerifiedAgenda} from '${moduleUrl}';mountVerifiedAgenda(document.querySelector('#agenda'),{projectId:'p1',projectName:'Fixture sintético autorizado',repo:{listVerifiedQaMeetings:window.loadAgendaFixture}});</script></html>`}));
 await page.goto(fixture);
 await expect(page.getByText('Consejo QA aislado',{exact:true})).toBeVisible();
 await expect(page.getByText('No autorizada',{exact:true})).toHaveCount(0);
 await page.getByLabel('Fecha en Colombia').fill('2026-11-12');
 await expect(page.getByText('No hay reuniones que coincidan con los filtros.')).toBeVisible();
 await page.getByLabel('Fecha en Colombia').fill('2026-11-11');
 await expect(page.getByText('Consejo QA aislado',{exact:true})).toBeVisible();
 await page.screenshot({path:testInfo.outputPath('agenda-desktop.png'),fullPage:true});
 failed=true;
 await page.getByRole('button',{name:'Actualizar consulta'}).click();
 await expect(page.getByRole('status')).toContainText('No se pudo consultar');
 await page.getByLabel('Buscar en agenda').fill('Consejo');
 await expect(page.getByRole('status')).toContainText('No se pudo consultar');
 await expect(page.getByText('Fixture query failed')).toHaveCount(0);
 await page.setViewportSize({width:390,height:850});
 await page.screenshot({path:testInfo.outputPath('agenda-mobile-error.png'),fullPage:true});
});
