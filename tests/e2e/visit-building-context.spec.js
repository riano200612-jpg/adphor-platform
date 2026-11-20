import {test,expect} from '../../qa/isolated-browser-test.js';

test('Visitas: edificio visible en formulario, tarjeta, seguimiento y consulta privada (390 px)',async({page,baseURL})=>{
 await page.setViewportSize({width:390,height:844});
 const moduleUrl=new URL('src/js/ui-visit-preparation.js',baseURL).href;
 const cssUrl=new URL('src/css/visits.css',baseURL).href;
 const html='<!doctype html><html lang="es"><meta charset="utf-8">'
 +'<meta name="viewport" content="width=device-width,initial-scale=1">'
 +'<link rel="stylesheet" href="'+cssUrl+'"><div id="visit"></div>'
 +'<script type="module">'
 +'import {mountVisitPreparation} from "'+moduleUrl+'";'
 +'const visit={project_id:"p1",request_id:"b330278f-54b4-41e6-89a1-805086ec3df4",'
 +'responsible_id:"u1",motive:"Inspección QA",scheduled_at:"2026-11-20T10:00:00-05:00",'
 +'status:"programada",started_at:null,finished_at:null,version:1};'
 +'const evidence={listEvidence:async()=>[],signedEvidence:async()=>""};'
 +'const repository={lifecycleEnabled:true,evidence,history:async()=>[],'
 +'list:async()=>[visit,{...visit,project_id:"p2",'
 +'request_id:"c330278f-54b4-41e6-89a1-805086ec3df4",'
 +'motive:"Novedad privada de otro edificio"}]};'
 +'mountVisitPreparation(document.getElementById("visit"),{'
 +'projectId:"p1",projectName:"Conjunto Entrelagos",'
 +'members:[{project_id:"p1",user_id:"u1",name:"Delegada de prueba"}],'
 +'canCreate:false,visitRepository:repository});'
 +'</script>';
 await page.route('**/qa-visit-building-context',route=>route.fulfill({contentType:'text/html',body:html}));
 await page.goto('./qa-visit-building-context');
 await expect(page.locator('[data-property]')).toHaveText('Estás trabajando en: Conjunto Entrelagos');
 await expect(page.locator('[data-visit-results] > li')).toHaveCount(1);
 await expect(page.getByText('Novedad privada de otro edificio')).toHaveCount(0);
 const card=page.locator('[data-visit-results] > li').first();
 await expect(card.locator('.visit-building-context').first()).toHaveText('Edificio: Conjunto Entrelagos');
 await card.getByText('Seguimiento · Programada',{exact:true}).click();
 await expect(card.locator('details .visit-building-context')).toBeVisible();
 await expect(card.locator('details .visit-building-context')).toHaveText('Edificio: Conjunto Entrelagos');
 await card.getByRole('button',{name:'Consultar evidencias de la visita'}).click();
 await expect(card.getByText('Esta visita aún no tiene evidencias.')).toBeVisible();
 await expect(card.locator('details .visit-building-context')).toBeVisible();
 const sizes=await page.evaluate(()=>{
  const nodes=[document.querySelector('[data-property]'),
   document.querySelector('[data-visit-results] .visit-building-context')];
  return {fonts:nodes.map(n=>parseFloat(getComputedStyle(n).fontSize)),
   width:document.documentElement.scrollWidth,viewport:innerWidth};
 });
 expect(sizes.fonts.every(size=>size>=18),JSON.stringify(sizes)).toBe(true);
 expect(sizes.width,JSON.stringify(sizes)).toBeLessThanOrEqual(sizes.viewport);
});
test('Visitas: el nombre de la copropiedad se muestra como texto, nunca HTML ejecutable',async({page,baseURL})=>{
 const moduleUrl=new URL('src/js/ui-visit-preparation.js',baseURL).href;
 const html='<!doctype html><html lang="es"><meta charset="utf-8"><div id="visit"></div>'
 +'<script type="module">'
 +'import {mountVisitPreparation} from "'+moduleUrl+'";'
 +'mountVisitPreparation(document.getElementById("visit"),{'
 +'projectId:"p1",projectName:'+JSON.stringify('<img src=x onerror=alert(1)>')+','
 +'members:[],canCreate:false,visitRepository:{lifecycleEnabled:false,list:async()=>[]}});'
 +'</script>';
 await page.route('**/qa-visit-safe-building-name',route=>route.fulfill({contentType:'text/html',body:html}));
 await page.goto('./qa-visit-safe-building-name');
 await expect(page.locator('[data-property]')).toContainText('<img src=x onerror=alert(1)>');
 await expect(page.locator('#visit img')).toHaveCount(0);
});

test('Visitas: la confirmación de registro identifica el edificio tras guardar un borrador sintético',async({page,baseURL})=>{
 const moduleUrl=new URL('src/js/ui-visit-preparation.js',baseURL).href;
 const html='<!doctype html><html lang="es"><meta charset="utf-8"><div id="visit"></div>'
 +'<script type="module">'
 +'import {mountVisitPreparation} from "'+moduleUrl+'";'
 +'mountVisitPreparation(document.getElementById("visit"),{'
 +'projectId:"p1",projectName:"Edificio Mares",'
 +'members:[{project_id:"p1",user_id:"u1",name:"Administradora de prueba"}],'
 +'canCreate:true,isolatedRepository:{lifecycleEnabled:false,'
 +'save:async(request)=>({project_id:request.projectId,request_id:request.requestId})}});'
 +'</script>';
 await page.route('**/qa-visit-save-building-confirmation',route=>route.fulfill({contentType:'text/html',body:html}));
 await page.goto('./qa-visit-save-building-confirmation');
 await page.getByLabel('Tipo o motivo').fill('Inspección sintética (sin escritura real)');
 await page.getByLabel('Fecha y hora (Colombia)',{exact:true}).fill('2026-11-21T10:00');
 await page.locator('select[name=responsible]').selectOption('u1');
 await page.getByRole('button',{name:'Revisar borrador'}).click();
 await expect(page.locator('[data-summary]')).toContainText('Edificio Mares');
 await page.getByRole('button',{name:'Confirmar y guardar borrador de prueba'}).click();
 await expect(page.locator('[data-summary]')).toContainText('Borrador de prueba guardado y confirmado');
 await expect(page.locator('[data-visit-saved-building]')).toHaveText('Visita guardada para: Edificio Mares');
 await expect(page.locator('[data-property]')).toHaveText('Estás trabajando en: Edificio Mares');
});
