import {test,expect} from '../../qa/isolated-browser-test.js';

async function fixture(page,baseURL,role='admin'){
 const chat=new URL('src/js/ui-miss-adphor-chat.js',baseURL).href;
 const css=new URL('src/css/premium.css',baseURL).href;
 const html=`<!doctype html><html lang="es"><head><meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <link rel="stylesheet" href="${css}"></head>
  <body><div id="miss-adphor-chat-root"></div><script type="module">
  const {mountMissAdphorChat}=await import('${chat}');
  const nav=[],calls=[];
  let identity={userId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',role:'${role}',mode:'cloud',
    projectId:'source-1',project:{id:'source-1',name:'Edificio QA'},page:'dashboard',
    tickets:[],availablePages:['dashboard','pqrs','visits','recorridos','meetings','reports']};
  window.qaMiss={nav,calls,setIdentity:next=>{identity=next},getIdentity:()=>identity};
  mountMissAdphorChat(document.getElementById('miss-adphor-chat-root'),{
    context:()=>identity,onNavigate:(page,task,draft)=>nav.push({page,task,draft})});
  </script></body></html>`;
 await page.route('**/miss-safe-qa-fixture',route=>route.fulfill({contentType:'text/html',body:html}));
 await page.goto('./miss-safe-qa-fixture');
 await page.locator('.miss-chat-toggle').click();
 return page.locator('.miss-chat-panel');
}
test('Miss QA mobile shows compact action hub, keeps quick prompts collapsed and never writes',async({page,baseURL})=>{
 await page.setViewportSize({width:390,height:844});
 const panel=await fixture(page,baseURL);
 await expect(panel.locator('.miss-task-hub')).toBeVisible();
 await expect(panel.locator('.miss-chat-more')).not.toHaveAttribute('open','');
 await expect(panel.locator('.miss-chat-quick')).not.toBeVisible();
 await panel.getByRole('button',{name:'Preparar visita'}).click();
 const rows=await page.evaluate(()=>window.qaMiss.nav);
 expect(rows).toEqual([{page:'visits',task:'visit'}]);
 expect(await page.evaluate(()=>window.qaMiss.calls)).toEqual([]);
 const bound=await panel.boundingBox();
 expect(bound).not.toBeNull();
 expect(bound.x).toBeGreaterThanOrEqual(0);
 expect(bound.x+bound.width).toBeLessThanOrEqual(391);
 expect(bound.height).toBeLessThanOrEqual(665);
});
test('Miss QA prepares PQRS only from explicit description; never saves it',async({page,baseURL})=>{
 const panel=await fixture(page,baseURL);
 const form=panel.locator('.miss-chat-form');
 await form.locator('input').fill('Radicar una PQRS por fuga de agua en el acceso de la torre');
 await form.getByRole('button',{name:'Consultar'}).click();
 await expect(panel.locator('.miss-chat-messages .assistant').last()).toContainText('Preparé asunto y descripción');
 await panel.locator('.miss-chat-jump').last().click();
 const navigations=await page.evaluate(()=>window.qaMiss.nav);
 expect(navigations).toHaveLength(1);
 expect(navigations[0]).toMatchObject({page:'pqrs',task:'pqrs'});
 expect(navigations[0].draft).toMatchObject({projectId:'source-1',
   subject:'fuga de agua en el acceso de la torre',
   description:'fuga de agua en el acceso de la torre'});
 expect(await page.evaluate(()=>window.qaMiss.calls)).toEqual([]);
});
test('Miss QA rejects stale PQRS draft after actor or tenant switch',async({page,baseURL})=>{
 const panel=await fixture(page,baseURL);
 const form=panel.locator('.miss-chat-form');
 await form.locator('input').fill('Radicar una PQRS por filtración de agua en la zona común');
 await form.getByRole('button',{name:'Consultar'}).click();
 await expect(panel.locator('.miss-chat-jump').last()).toBeVisible();
 await page.evaluate(()=>{const p=window.qaMiss.getIdentity();
  window.qaMiss.setIdentity({...p,projectId:'source-2',project:{id:'source-2',name:'Otro edificio'}})});
 await panel.locator('.miss-chat-jump').last().click();
 expect(await page.evaluate(()=>window.qaMiss.nav)).toEqual([]);
});
test('Miss QA viewer cannot start manager-only tasks; documents remain disabled',async({page,baseURL})=>{
 const panel=await fixture(page,baseURL,'viewer');
 await expect(panel.getByRole('button',{name:'Preparar visita'})).toHaveCount(0);
 await expect(panel.getByRole('button',{name:'Informe semanal'})).toHaveCount(0);
 await panel.getByRole('button',{name:'Documentos · pendiente'}).click();
 await expect(panel.locator('.miss-chat-messages .assistant').last()).toContainText('desactivada');
 expect(await page.evaluate(()=>window.qaMiss.nav)).toEqual([]);
});
