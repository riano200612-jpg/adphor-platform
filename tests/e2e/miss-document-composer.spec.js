import {test,expect} from '../../qa/isolated-browser-test.js';

test('Miss document composer uploads a copy and registers Drive URL only in authorized property',async({page,baseURL})=>{
 const url=new URL('src/js/ui-miss-chat-document-composer.js',baseURL).href;
 const html=`<!doctype html><html lang="es"><meta charset="utf-8"><div id="miss"></div>
 <script type="module">
 import {mountMissChatDocumentComposer} from '${url}';
 const calls=[];
 let session={userId:'user-a',project:{id:'source-1'},projectId:'source-1',role:'viewer',mode:'cloud'};
 window.missQA={calls,setSession:next=>{session=next},getSession:()=>session};
 mountMissChatDocumentComposer(document.getElementById('miss'),{
  context:()=>session,
  uploadDocument:async(projectId,file)=>{calls.push({kind:'upload',projectId,name:file.name})},
  submitDriveLink:async(projectId,link,name)=>{calls.push({kind:'drive',projectId,link,name})}
 });
 </script>`;
 await page.route('**/miss-qa-documents-fixture',r=>r.fulfill({contentType:'text/html',body:html}));
 await page.goto('./miss-qa-documents-fixture');
 const box=page.locator('details.miss-chat-documents');
 await expect(box).toHaveCount(1);
 await box.locator('summary').click();
 await box.locator('input[type=file]').setInputFiles({
  name:'Acta.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.7\nprueba QA')
 });
 await box.getByRole('button',{name:'Subir copia a cuarentena'}).click();
 await expect(box.locator('form').first().getByRole('status')).toContainText('Archivo guardado en cuarentena');
 await box.locator('input[type=url]').fill('https://drive.google.com/file/d/1RTkvbz6YZftW4Ua_3XHs4PVEPX1kyotG/view');
 await box.locator('input[name=title]').fill('Acta del consejo');
 await box.getByRole('button',{name:'Registrar enlace para revisión'}).click();
 await expect(box.locator('form').last().getByRole('status')).toContainText('Enlace registrado en cuarentena');
 const calls=await page.evaluate(()=>window.missQA.calls);
 expect(calls).toHaveLength(2);
 expect(calls.map(x=>x.projectId)).toEqual(['source-1','source-1']);
 expect(calls[0]).toMatchObject({kind:'upload',name:'Acta.pdf'});
 expect(calls[1]).toMatchObject({kind:'drive',name:'Acta del consejo'});
});
test('Miss document composer does not upload for anonymous or demo sessions',async({page,baseURL})=>{
 const url=new URL('src/js/ui-miss-chat-document-composer.js',baseURL).href;
 const html=`<!doctype html><html lang="es"><meta charset="utf-8"><div id="miss"></div>
 <script type="module">
 import {mountMissChatDocumentComposer} from '${url}';
 let session={userId:'',project:{id:'source-1'},projectId:'source-1',role:'viewer',mode:'cloud'};
 window.missQA={setSession:next=>{session=next},calls:[]};
 mountMissChatDocumentComposer(document.getElementById('miss'),{
  context:()=>session,
  uploadDocument:async()=>window.missQA.calls.push('file'),
  submitDriveLink:async()=>window.missQA.calls.push('drive')
 });
 </script>`;
 await page.route('**/miss-qa-unauthorized-fixture',r=>r.fulfill({contentType:'text/html',body:html}));
 await page.goto('./miss-qa-unauthorized-fixture');
 const box=page.locator('details.miss-chat-documents');await box.locator('summary').click();
 await box.locator('input[type=file]').setInputFiles({name:'Acta.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.7')});
 await box.getByRole('button',{name:'Subir copia a cuarentena'}).click();
 await expect(box.locator('form').first().getByRole('status')).toContainText('Inicia sesión');
 await page.evaluate(()=>window.missQA.setSession({userId:'user-a',project:{id:'source-1'},projectId:'source-1',role:'viewer',mode:'demo'}));
 await box.locator('input[type=url]').fill('https://drive.google.com/file/d/1RTkvbz6YZftW4Ua_3XHs4PVEPX1kyotG/view');
 await box.locator('input[name=title]').fill('Acta del consejo');
 await box.getByRole('button',{name:'Registrar enlace para revisión'}).click();
 await expect(box.locator('form').last().getByRole('status')).toContainText('Inicia sesión');
 expect(await page.evaluate(()=>window.missQA.calls)).toEqual([]);
});
