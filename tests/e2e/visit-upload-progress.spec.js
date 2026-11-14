import {test,expect} from '../../qa/isolated-browser-test.js';

test('Visitas: progreso parcial, reintento idempotente y confirmación ante error de lectura',async({page,baseURL})=>{
 const projectId='p1',requestId='a330278f-54b4-41e6-89a1-805086ec3df4';
 const stored=new Map();const attempts=new Map();
 let failSecond=true,failReadOnce=true;
 await page.exposeFunction('qaSaveAttachment',async file=>{
  attempts.set(file.name,(attempts.get(file.name)||0)+1);
  if(file.name==='segundo.pdf'&&failSecond){failSecond=false;throw Error('Transient Storage failure');}
  if(!stored.has(file.name)){
   stored.set(file.name,{id:'c8709acb-9e96-8dfa-b3d1-53f42528315b',project_id:projectId,
    request_id:requestId,media_type:file.type,file_name:file.name,file_bytes:file.size,
    created_at:'2026-11-14T12:00:00Z'});
  }
  return stored.get(file.name);
 });
 await page.exposeFunction('qaReadAttachment',async()=>{
  if(failReadOnce){failReadOnce=false;throw Error('Transient list failure after COMMIT');}
  return Array.from(stored.values());
 });
 const moduleUrl=new URL('src/js/ui-visit-evidence.js',baseURL).href;
 const html='<!doctype html><html lang="es"><meta charset="utf-8"><div id="visits"></div><script type="module">'
  +'import {mountVisitEvidence} from "'+moduleUrl+'";'
  +'mountVisitEvidence(document.getElementById("visits"),{row:{project_id:"p1",request_id:"'+requestId+'",status:"en_ejecucion"},canWrite:true,'
  +'evidence:{listEvidence:async()=>window.qaReadAttachment(),signedEvidence:async()=>{throw Error("not requested")},'
  +'uploadEvidence:async({files,onProgress})=>{const done=[];const entries=Array.from(files);for(const file of entries){'
  +'const row=await window.qaSaveAttachment({name:file.name,type:file.type,size:file.size});'
  +'done.push({id:row.id,project_id:row.project_id,request_id:row.request_id,storage_written:true,metadata_linked:true});'
  +'onProgress?.({completed:done.length,total:entries.length});}return done;}}});</script></html>';
 await page.route('**/visit-upload-progress-fixture',route=>route.fulfill({contentType:'text/html',body:html}));
 await page.goto('./visit-upload-progress-fixture');
 const save=page.getByRole('button',{name:'Guardar evidencias privadas'});
 await page.locator('input[type=file]').setInputFiles([
  {name:'primero.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.7 uno')},
  {name:'segundo.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.7 dos')}
 ]);
 await expect(save).toBeEnabled();
 await save.click();
 await expect(page.locator('.visit-evidence > [role="status"]').first()).toContainText('Se confirmaron 1 de 2 archivo(s)');
 await expect(save).toBeEnabled();
 await expect(page.locator('[data-visit-selected-files] li')).toHaveCount(2);
 await save.click();
 await expect(page.locator('.visit-evidence > [role="status"]').first()).toContainText('2 archivo(s) guardado(s) correctamente');
 await expect(page.locator('.visit-evidence > [role="status"]').first()).toContainText('No se pudo actualizar el listado');
 await expect(save).toBeDisabled();
 await expect(page.locator('[data-visit-selected-files] li')).toHaveCount(0);
 await page.getByRole('button',{name:'Consultar evidencias de la visita'}).click();
 await expect(page.locator('[data-visit-evidence-list] li')).toHaveCount(2);
 await expect(page.locator('[data-visit-evidence-list]')).toContainText('primero.pdf');
 await expect(page.locator('[data-visit-evidence-list]')).toContainText('segundo.pdf');
 await expect(page.locator('a[data-visit-signed]')).toHaveCount(0);
 expect(Array.from(stored.keys())).toEqual(['primero.pdf','segundo.pdf']);
 expect(attempts.get('primero.pdf')).toBe(2);
 expect(attempts.get('segundo.pdf')).toBe(2);
});
