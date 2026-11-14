import {test,expect} from '../../qa/isolated-browser-test.js';

// Isolated fixture: verifies actual browser UI, not hosted Supabase or an AAL2 session.
test('Visitas: private files persist across page reload and signed URL is user-initiated',async({page,baseURL})=>{
 const projectId='p1',requestId='a330278f-54b4-41e6-89a1-805086ec3df4';
 const stored=[];let saves=0,reads=0,signatures=0;
 await page.exposeFunction('qaVisitRead',async()=>{reads++;return stored.map(x=>({...x}));});
 await page.exposeFunction('qaVisitSave',async(files)=>{
  saves++;
  const out=[];
  for(const f of files){
   let row=stored.find(x=>x.name===f.name&&x.file_bytes===f.size);
   if(!row){
    row={id:'c8709acb-9e96-8dfa-b3d1-53f42528315b',project_id:projectId,request_id:requestId,
     media_type:f.type,file_bytes:f.size,created_at:'2026-11-13T12:00:00Z',name:f.name};
    stored.push(row);
   }
   out.push({id:row.id,project_id:projectId,request_id:requestId,storage_written:true,metadata_linked:true});
  }
  return out;
 });
 await page.exposeFunction('qaVisitSign',async()=>{signatures++;
  return 'https://qfctnnnnltghepwujpdm.supabase.co/storage/v1/object/sign/qa-visit-evidence/p1/visitas/test?token=synthetic';
 });
 const moduleUrl=new URL('src/js/ui-visit-evidence.js',baseURL).href;
 const html=`<!doctype html><html lang="es"><meta charset="utf-8"><div id="test-visit"></div>
 <script type="module">
 import {mountVisitEvidence} from '${moduleUrl}';
 const projectId='p1',requestId='a330278f-54b4-41e6-89a1-805086ec3df4';
 const evidence={
  listEvidence:async(p,r)=>{if(p!==projectId||r!==requestId)throw Error('scope');return window.qaVisitRead();},
  signedEvidence:async(p,r,id)=>{if(p!==projectId||r!==requestId)throw Error('scope');return window.qaVisitSign(id);},
  uploadEvidence:async({projectId:p,requestId:r,files})=>{if(p!==projectId||r!==requestId)throw Error('scope');
   return window.qaVisitSave(Array.from(files).map(f=>({name:f.name,size:f.size,type:f.type})));
  }
 };
 mountVisitEvidence(document.getElementById('test-visit'),{
  row:{project_id:projectId,request_id:requestId,status:'en_ejecucion'},evidence,canWrite:true});
 </script></html>`;
 await page.route('**/visit-private-evidence-fixture',route=>route.fulfill({contentType:'text/html',body:html}));
 await page.goto('./visit-private-evidence-fixture');
 await page.getByRole('button',{name:'Consultar evidencias de la visita'}).click();
 await expect(page.locator('[data-visit-evidence-list]')).toContainText('aún no tiene evidencias');
 const saveButton=page.getByRole('button',{name:'Guardar evidencias privadas'});
 await expect(saveButton).toBeDisabled();
 await page.locator('input[type=file]').setInputFiles({name:'inseguro.exe',mimeType:'application/x-msdownload',buffer:Buffer.from('invalid')});
 await expect(page.locator('[data-visit-selection-status]')).toContainText('Archivo no permitido');
 await expect(saveButton).toBeDisabled();
 await expect(page.locator('[data-visit-selected-files] li')).toHaveCount(0);
 await page.locator('input[type=file]').setInputFiles({name:'acta.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.7')});
 await expect(page.locator('[data-visit-selected-files]')).toContainText('acta.pdf');
 await expect(page.locator('[data-visit-selection-status]')).toContainText('1 archivo(s) listos');
 await expect(saveButton).toBeEnabled();
 await saveButton.click();
 await expect(saveButton).toBeDisabled();
 await expect(page.locator('[data-visit-selected-files] li')).toHaveCount(0);
 await expect(page.locator('[data-visit-evidence-list]')).toContainText('application/pdf');
 await expect(page.locator('a[data-visit-signed]')).toHaveCount(0);
 await page.reload();
 await expect(page.locator('a[data-visit-signed]')).toHaveCount(0);
 await page.getByRole('button',{name:'Consultar evidencias de la visita'}).click();
 await expect(page.locator('[data-visit-evidence-list] li')).toHaveCount(1);
 await page.getByRole('button',{name:'Preparar enlace privado'}).click();
 const link=page.getByRole('link',{name:'Abrir archivo (90 segundos)'});
 await expect(link).toHaveAttribute('href',/^https:\/\/qfctnnnnltghepwujpdm.supabase.co\/storage\/v1\/object\/sign\/qa-visit-evidence/);
 await expect(link).toHaveAttribute('rel','noopener noreferrer');
 expect(saves).toBe(1);
 expect(reads).toBeGreaterThanOrEqual(3);
 expect(signatures).toBe(1);
 // Final states are read-only even when canWrite is true.
 for(const status of ['completada','cancelada']){
  await page.evaluate(async({url,projectId,requestId,status})=>{
   const {mountVisitEvidence}=await import(url);
   const root=document.createElement('div');root.id='closed-visit-'+status;
   document.body.append(root);
   mountVisitEvidence(root,{
    row:{project_id:projectId,request_id:requestId,status},
    evidence:{listEvidence:()=>window.qaVisitRead(),signedEvidence:()=>window.qaVisitSign()},
    canWrite:true
   });
  },{url:moduleUrl,projectId,requestId,status});
  await expect(page.locator('#closed-visit-'+status+' input[type=file]')).toHaveCount(0);
  await expect(page.locator('#closed-visit-'+status).getByRole('button',{name:'Consultar evidencias de la visita'})).toBeVisible();
 }
});
