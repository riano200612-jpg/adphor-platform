import {test,expect} from '../../qa/isolated-browser-test.js';

async function fixture(page,baseURL,{role='admin',documentsEnabled=true}={}){
 const chatUrl=new URL('src/js/ui-miss-adphor-chat.js',baseURL).href;
 const stylesheet=new URL('src/css/premium.css',baseURL).href;
 const html=`<!doctype html><html lang="es"><head><meta charset="utf-8">
 <meta name="viewport" content="width=device-width,initial-scale=1">
 <link rel="stylesheet" href="${stylesheet}"></head><body>
 <div id="miss-adphor-chat-root"></div>
 <script type="module">
 const {mountMissAdphorChat}=await import('${chatUrl}');
 const nav=[];const writes=[];const context={
  mode:'cloud',userId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  projectId:'source-1',project:{id:'source-1',name:'Edificio QA'},
  role:'${role}',availablePages:['dashboard','pqrs','visits','meetings',
   'recorridos','reports','miss-documents'],
  documentsEnabled:${documentsEnabled},tickets:[],page:'dashboard'
 };
 window.missFixture={nav,writes};
 mountMissAdphorChat(document.getElementById('miss-adphor-chat-root'),{
  context:()=>context,
  documentsEnabled:${documentsEnabled},
  uploadDocument:async()=>writes.push('upload'),
  submitDriveLink:async()=>writes.push('link'),
  onNavigate:(page,task)=>nav.push({page,task})
 });
 </script></body></html>`;
 await page.route('**/miss-task-hub-fixture',r=>r.fulfill({contentType:'text/html',body:html}));
 await page.goto('./miss-task-hub-fixture');
 await page.locator('.miss-chat-toggle').click();
 return page.locator('.miss-chat-panel');
}
test('Miss mobile task hub prepares a real module without submitting and keeps quick replies collapsed',async({page,baseURL})=>{
 await page.setViewportSize({width:390,height:844});
 const panel=await fixture(page,baseURL);
 await expect(panel).toBeVisible();
 await expect(panel.locator('.miss-task-hub')).toBeVisible();
 await expect(panel.locator('.miss-chat-more')).not.toHaveAttribute('open','');
 await expect(panel.locator('.miss-chat-quick')).not.toBeVisible();
 await panel.getByRole('button',{name:'Preparar visita'}).click();
 const nav=await page.evaluate(()=>window.missFixture.nav);
 expect(nav).toEqual([{page:'visits',task:'visit'}]);
 expect(await page.evaluate(()=>window.missFixture.writes)).toEqual([]);
 const bounds=await panel.boundingBox();
 expect(bounds).toBeTruthy();
 expect(bounds.x).toBeGreaterThanOrEqual(0);
 expect(bounds.x+bounds.width).toBeLessThanOrEqual(391);
 expect(bounds.height).toBeLessThanOrEqual(665);
});
test('Miss document task reveals quarantine form but does not upload without explicit submit',async({page,baseURL})=>{
 const panel=await fixture(page,baseURL);
 const details=panel.locator('details.miss-chat-documents');
 await expect(details).not.toHaveAttribute('open','');
 await panel.getByRole('button',{name:'Adjuntar documento'}).click();
 await expect(details).toHaveAttribute('open','');
 await expect(details.locator('input[type=file]')).toBeVisible();
 expect(await page.evaluate(()=>window.missFixture.writes)).toEqual([]);
 await panel.getByLabel('¿En qué puedo ayudarte?').fill('radicar una PQRS');
 await panel.getByRole('button',{name:'Consultar'}).click();
 await expect(panel.locator('.miss-chat-jump').last()).toBeVisible();
 await panel.locator('.miss-chat-jump').last().click();
 expect(await page.evaluate(()=>window.missFixture.nav)).toEqual([{page:'pqrs',task:'pqrs'}]);
});
test('Miss denies manager-only tasks to viewer and explains document flag-off without writes',async({page,baseURL})=>{
 const panel=await fixture(page,baseURL,{role:'viewer',documentsEnabled:false});
 await expect(panel.getByRole('button',{name:'Preparar visita'})).toHaveCount(0);
 await expect(panel.getByRole('button',{name:'Informe semanal'})).toHaveCount(0);
 await panel.getByRole('button',{name:'Documentos · pendiente'}).click();
 await expect(panel.locator('.miss-chat-messages .assistant').last()).toContainText('desactivada');
 expect(await page.evaluate(()=>window.missFixture.nav)).toEqual([]);
 expect(await page.evaluate(()=>window.missFixture.writes)).toEqual([]);
});
