import {test,expect} from '../../qa/isolated-browser-test.js';
test('Visitas: muestra más de 50 evidencias privadas y permite reiniciar la lectura',async({page,baseURL})=>{
 const projectId='p1',requestId='a330278f-54b4-41e6-89a1-805086ec3df4';
 const evidence=Array.from({length:51},(_,i)=>({
  id:'b8888888-8888-4888-8888-'+String(i+1).padStart(12,'0'),
  project_id:projectId,request_id:requestId,
  file_name:'documento-'+String(51-i).padStart(3,'0')+'.pdf',
  media_type:'application/pdf',file_bytes:100,created_at:'2026-11-14T15:00:00Z'
 }));
 let calls=0;
 await page.exposeFunction('qaReadEvidencePage',async(offset)=>{
  calls++;
  return {rows:evidence.slice(offset,offset+50),hasMore:evidence.length>offset+50};
 });
 const moduleUrl=new URL('src/js/ui-visit-evidence.js',baseURL).href;
 const html='<!doctype html><html lang="es"><meta charset="utf-8"><div id="visit"></div><script type="module">'
  +'import {mountVisitEvidence} from "'+moduleUrl+'";'
  +'mountVisitEvidence(document.getElementById("visit"),{'
  +'row:{project_id:"p1",request_id:"a330278f-54b4-41e6-89a1-805086ec3df4",status:"completada"},'
  +'canWrite:false,evidence:{'
  +'listEvidence:async()=>{throw Error("Legacy limit must not be used")},'
  +'listEvidencePage:(p,r,offset)=>{if(p!=="p1"||r!=="a330278f-54b4-41e6-89a1-805086ec3df4")throw Error("scope");return window.qaReadEvidencePage(offset)},'
  +'signedEvidence:async()=>{throw Error("No signed URL without user action")}'
  +'}});</script></html>';
 await page.route('**/qa-evidence-pagination',route=>route.fulfill({contentType:'text/html',body:html}));
 await page.goto('./qa-evidence-pagination');
 const read=page.getByRole('button',{name:'Consultar evidencias de la visita'});
 const more=page.getByRole('button',{name:'Mostrar más evidencias privadas'});
 await expect(more).toBeHidden();
 await read.click();
 await expect(page.locator('[data-visit-evidence-list] li')).toHaveCount(50);
 await expect(page.locator('[data-visit-evidence-list] li').first()).toContainText('documento-051.pdf');
 await expect(more).toBeVisible();
 await expect(page.locator('a[data-visit-signed]')).toHaveCount(0);
 await more.click();
 await expect(page.locator('[data-visit-evidence-list] li')).toHaveCount(51);
 await expect(page.locator('[data-visit-evidence-list] li').last()).toContainText('documento-001.pdf');
 await expect(more).toBeHidden();
 await read.click();
 await expect(page.locator('[data-visit-evidence-list] li')).toHaveCount(50);
 await expect(more).toBeVisible();
 expect(calls).toBe(3);
});
