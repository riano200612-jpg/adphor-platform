import {test,expect} from '../../qa/isolated-browser-test.js';

test('Visitas: acceso visible a adjuntos abre el selector, sin exponerlo en estados finales',async({page,baseURL})=>{
 const moduleUrl=new URL('src/js/ui-visit-lifecycle.js',baseURL).href;
 const html=`<!doctype html><html lang="es"><meta charset="utf-8">
 <div id="programada"></div><div id="en_ejecucion"></div>
 <div id="completada"></div><div id="cancelada"></div><div id="solo-lectura"></div>
 <script type="module">
  import {mountVisitLifecycle} from '${moduleUrl}';
  const evidence={
   listEvidence:async()=>[],signedEvidence:async()=>'',uploadEvidence:async()=>[]
  };
  const repository={evidence,history:async()=>[],transition:async()=>{}};
  const base={project_id:'p1',request_id:'a330278f-54b4-41e6-89a1-805086ec3df4',
   motive:'Inspección QA',scheduled_at:'2026-11-14T10:00:00-05:00',responsible_id:'u1',
   started_at:null,finished_at:null,version:1};
  for(const status of ['programada','en_ejecucion','completada','cancelada']){
   mountVisitLifecycle(document.getElementById(status),{
    row:{...base,status},repository,canWrite:true,
    responsibleNames:new Map([['u1','Administrador QA']]),reload:async()=>{}
   });
  }
  mountVisitLifecycle(document.getElementById('solo-lectura'),{
   row:{...base,status:'programada'},repository,canWrite:false,
   responsibleNames:new Map([['u1','Administrador QA']]),reload:async()=>{}
  });
 </script></html>`;
 await page.route('**/visit-attachment-shortcut-fixture',route=>route.fulfill({contentType:'text/html',body:html}));
 await page.goto('./visit-attachment-shortcut-fixture');
 for(const status of ['programada','en_ejecucion']){
  const root=page.locator('#'+status);
  const button=root.getByRole('button',{name:'Adjuntar imágenes o documentos'});
  await expect(button).toBeVisible();
  await button.click();
  await expect(root.locator('.visit-evidence input[type=file]')).toBeVisible();
  await expect(root.getByRole('button',{name:'Guardar evidencias privadas'})).toBeVisible();
 }
 for(const status of ['completada','cancelada','solo-lectura']){
  const root=page.locator('#'+status);
  await expect(root.locator('[data-visit-attach-shortcut]')).toHaveCount(0);
  await expect(root.locator('input[type=file]')).toHaveCount(0);
 }
});
