import {test,expect} from '../../qa/isolated-browser-test.js';
test('Generated DOCX and XLSX use the usual visit private upload and no signed link before request',async({page,baseURL})=>{
 const fixtureUrl=new URL('src/js/services/qa-visit-synthetic-office.js',baseURL).href;
 const moduleUrl=new URL('src/js/ui-visit-evidence.js',baseURL).href;
 const files=[],saved=[];
 await page.exposeFunction('qaWriteOffice',async entries=>{
  for(const item of entries){
   files.push(item);
   if(!saved.some(f=>f.file_name===item.name))
    saved.push({id:'a4df8fbc-2323-4cb0-82c7-a7c41c500bad',
     project_id:'source-1',request_id:'ea01dd3c-9fc8-4ac4-9d2a-6c6c345993c7',
     file_name:item.name,media_type:item.type,file_bytes:item.size,
     created_at:'2026-11-17T15:00:00Z'});
  }
  return entries.map((_,i)=>({id:'file-'+i,project_id:'source-1',
   request_id:'ea01dd3c-9fc8-4ac4-9d2a-6c6c345993c7',
   storage_written:true,metadata_linked:true}));
 });
 await page.exposeFunction('qaReadOffice',async()=>saved);
 const html='<!doctype html><html lang="es"><div id="visit"></div><script type="module">'
  +'import {mountVisitEvidence} from "'+moduleUrl+'";'
  +'mountVisitEvidence(document.getElementById("visit"),{row:{'
  +'project_id:"source-1",request_id:"ea01dd3c-9fc8-4ac4-9d2a-6c6c345993c7",'
  +'status:"programada",motive:"[QA E2E 2026-11-17] SIN VISITA REAL"},canWrite:true,'
  +'evidence:{listEvidence:async()=>window.qaReadOffice(),'
  +'signedEvidence:async()=>{throw Error("Signed links require user click")},'
  +'uploadEvidence:async({files})=>window.qaWriteOffice(await Promise.all(Array.from(files).map(async f=>('
  +'{name:f.name,type:f.type,size:f.size,bytes:Array.from(new Uint8Array(await f.arrayBuffer()))}'
  +'))))}});</script></html>';
 await page.route('**/qa-office-upload-fixture',route=>route.fulfill({body:html,contentType:'text/html'}));
 await page.goto('./qa-office-upload-fixture');
 await expect(page.locator('[data-visit-synthetic-office]')).toHaveCount(0); // localhost
 const save=page.getByRole('button',{name:'Guardar evidencias privadas'});
 for(const kind of ['docx','xlsx']){
  await page.evaluate(async({fixtureUrl,kind})=>{
   const {createSyntheticVisitOfficeFile}=await import(fixtureUrl);
   const transfer=new DataTransfer();
   transfer.items.add(createSyntheticVisitOfficeFile(kind));
   const input=document.querySelector('.visit-evidence input[type=file]');
   input.files=transfer.files;
   input.dispatchEvent(new Event('change',{bubbles:true}));
  },{fixtureUrl,kind});
  await expect(page.locator('[data-visit-selected-files]')).toContainText('ADPHOR-QA-SINTETICO-NO-REAL.'+kind);
  await expect(save).toBeEnabled();
  await save.click();
  await expect(page.locator('.visit-evidence > [role=status]').first()).toContainText('1 archivo(s) guardado(s)');
  await expect(page.locator('a[data-visit-signed]')).toHaveCount(0);
 }
 await page.getByRole('button',{name:'Consultar evidencias de la visita'}).click();
 await expect(page.locator('[data-visit-evidence-list] li')).toHaveCount(2);
 expect(files.map(f=>f.name)).toEqual(['ADPHOR-QA-SINTETICO-NO-REAL.docx','ADPHOR-QA-SINTETICO-NO-REAL.xlsx']);
 for(const file of files){
  expect(file.bytes.slice(0,4)).toEqual([80,75,3,4]);
  expect(file.size).toBeGreaterThan(500);
 }
});
