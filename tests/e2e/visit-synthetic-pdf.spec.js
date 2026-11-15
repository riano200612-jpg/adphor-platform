import {test,expect} from '../../qa/isolated-browser-test.js';
test('Browser can generate an original QA PDF and select it for the normal private upload flow',async({page,baseURL})=>{
 const moduleUrl=new URL('src/js/ui-visit-evidence.js',baseURL).href;
 const fixtureUrl=new URL('src/js/services/qa-visit-synthetic-pdf.js',baseURL).href;
 const records=[];
 await page.exposeFunction('qaWriteGeneratedPdf',async files=>{
  for(const f of files)records.push(f);
  return files.map((_,i)=>({id:'id-'+i,project_id:'source-1',
    request_id:'ea01dd3c-9fc8-4ac4-9d2a-6c6c345993c7',storage_written:true,metadata_linked:true}));
 });
 const html='<!doctype html><html lang="es"><div id="visit"></div><script type="module">'
  +'import {mountVisitEvidence} from "'+moduleUrl+'";'
  +'mountVisitEvidence(document.getElementById("visit"),{'
  +'row:{project_id:"source-1",request_id:"ea01dd3c-9fc8-4ac4-9d2a-6c6c345993c7",'
  +'status:"programada",motive:"[QA E2E 2026-11-15] SIN VISITA REAL"},canWrite:true,evidence:{'
  +'listEvidence:async()=>[],signedEvidence:async()=>{throw Error("No sign without click")},'
  +'uploadEvidence:async({files})=>window.qaWriteGeneratedPdf(Array.from(files).map(f=>({name:f.name,size:f.size,type:f.type})))'
  +'}});</script></html>';
 await page.route('**/qa-original-pdf-fixture',route=>route.fulfill({contentType:'text/html',body:html}));
 await page.goto('./qa-original-pdf-fixture');
 // Localhost is never allowed to expose the QA-only convenience control.
 await expect(page.locator('[data-visit-synthetic-pdf]')).toHaveCount(0);
 await page.evaluate(async url=>{
  const {createSyntheticVisitPdfFile}=await import(url);
  const file=createSyntheticVisitPdfFile(),transfer=new DataTransfer();
  transfer.items.add(file);
  const input=document.querySelector('.visit-evidence input[type=file]');
  input.files=transfer.files;
  input.dispatchEvent(new Event('change',{bubbles:true}));
 },fixtureUrl);
 await expect(page.locator('[data-visit-selected-files]')).toContainText('ADPHOR-QA-SINTETICO-NO-REAL.pdf');
 await page.getByRole('button',{name:'Guardar evidencias privadas'}).click();
 await expect(page.locator('.visit-evidence > [role=status]').first()).toContainText('1 archivo(s) guardado(s)');
 expect(records).toHaveLength(1);
 expect(records[0].type).toBe('application/pdf');
 expect(records[0].size).toBeGreaterThan(300);
 await expect(page.locator('a[data-visit-signed]')).toHaveCount(0);
});
