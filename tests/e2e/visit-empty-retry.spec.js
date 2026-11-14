import {test,expect} from '../../qa/isolated-browser-test.js';

// Read-only synthetic fixture: tests retry, empty-state and accessible first-visit focus.
test('Visitas: error retry, empty first-visit guidance and refresh without reload',async({page,baseURL})=>{
 let calls=0,hasVisit=false;
 await page.exposeFunction('qaReadVisits',async()=>{
  calls++;
  if(calls===1)throw Error('Synthetic read failure');
  if(!hasVisit)return [];
  return [{project_id:'p1',request_id:'a330278f-54b4-41e6-89a1-805086ec3df4',
   responsible_id:'u1',motive:'Inspección autorizada',scheduled_at:'2026-11-14T10:00:00-05:00'}];
 });
 await page.exposeFunction('qaAddVisit',()=>{hasVisit=true;});
 const moduleUrl=new URL('src/js/ui-visit-preparation.js',baseURL).href;
 const html=`<!doctype html><html lang="es"><meta charset="utf-8"><div id="visit"></div>
 <script type="module">
 import {mountVisitPreparation} from '${moduleUrl}';
 mountVisitPreparation(document.getElementById('visit'),{
  projectId:'p1',projectName:'Copropiedad aislada',members:[{project_id:'p1',user_id:'u1',name:'Administrador QA'}],
  canCreate:true,visitRepository:{lifecycleEnabled:false,list:window.qaReadVisits,save:async()=>{throw Error('writes not permitted in this fixture')}}
 });
 </script>`;
 await page.route('**/qa-visit-read-retry',route=>route.fulfill({contentType:'text/html',body:html}));
 await page.goto('./qa-visit-read-retry');
 const refresh=page.getByRole('button',{name:'Actualizar visitas'});
 await expect(refresh).toBeVisible();
 await expect(page.locator('[data-list-status]')).toContainText('No se pudieron consultar las visitas');
 await expect(refresh).toBeEnabled();
 await refresh.click();
 await expect(page.locator('[data-list-status]')).toContainText('Todavía no hay visitas registradas');
 await expect(page.locator('[data-visit-empty-guide]')).toBeVisible();
 await expect(page.locator('[data-visit-empty-message]')).toContainText('podrás adjuntar imágenes y documentos');
 await page.getByRole('button',{name:'Preparar primera visita'}).click();
 await expect(page.getByLabel('Tipo o motivo')).toBeFocused();
 await page.evaluate(()=>window.qaAddVisit());
 await refresh.click();
 await expect(page.locator('[data-visit-results] > li')).toHaveCount(1);
 await expect(page.locator('[data-visit-empty-guide]')).toBeHidden();
 expect(calls).toBe(3);
});
test('Visitas: empty read-only state does not advertise scheduling permissions',async({page,baseURL})=>{
 const moduleUrl=new URL('src/js/ui-visit-preparation.js',baseURL).href;
 const html=`<!doctype html><html lang="es"><meta charset="utf-8"><div id="visit"></div>
 <script type="module">
 import {mountVisitPreparation} from '${moduleUrl}';
 mountVisitPreparation(document.getElementById('visit'),{
  projectId:'p1',projectName:'Copropiedad aislada',members:[],canCreate:false,
  visitRepository:{lifecycleEnabled:false,list:async()=>[]}
 });
 </script>`;
 await page.route('**/qa-visit-readonly-empty',route=>route.fulfill({contentType:'text/html',body:html}));
 await page.goto('./qa-visit-readonly-empty');
 await expect(page.locator('[data-visit-empty-guide]')).toBeVisible();
 await expect(page.locator('[data-visit-empty-message]')).toContainText('Administración o Coordinación');
 await expect(page.getByRole('button',{name:'Preparar primera visita'})).toBeHidden();
 await expect(page.getByRole('button',{name:'Revisar visita'})).toBeDisabled();
 await expect(page.getByRole('button',{name:'Abrir seguimiento de la visita registrada'})).toHaveCount(0);
});
