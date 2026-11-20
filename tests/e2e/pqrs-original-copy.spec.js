import {test,expect} from '@playwright/test';

test('PQRS original: consulta copiable sin radicar ni escribir en el sistema de José',async({page})=>{
  await page.goto('/adphor-platform/');
  await page.evaluate(async()=>{
    const {mountUnifiedPqrs}=await import('/adphor-platform/src/js/ui-pqrs-unified.js');
    const root=document.createElement('div');
    root.id='pqrs-original-test-root';
    document.body.replaceChildren(root);
    const saved={};
    const storage={getItem:key=>saved[key]||null,setItem:(key,value)=>{saved[key]=value;}};
    const opened=[];
    window.__pqrsOpened=opened;
    window.__pqrsCopied=[];
    Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async value=>window.__pqrsCopied.push(value)}});
    mountUnifiedPqrs(root,{role:'admin',environment:'https://script.google.com/macros/s/AKfycbxw64JyydOaye-GksILdtYO4KvshS3OrNW6lXAKmq_Q/exec',storage,open:url=>opened.push(url)});
  });
  const root=page.locator('#pqrs-original-test-root');
  await expect(root.getByRole('status')).toContainText('No se ha podido verificar el formulario original');
  const copy=root.getByRole('button',{name:'Copiar enlace de consulta'});
  await expect(copy).toBeHidden();
  await root.getByRole('button',{name:'Consultar radicado'}).click();
  await expect(copy).toBeVisible();
  await expect(copy).toBeEnabled();
  await copy.click();
  const expected='https://script.google.com/macros/s/AKfycbxw64JyydOaye-GksILdtYO4KvshS3OrNW6lXAKmq_Q/exec?page=status';
  expect(await page.evaluate(()=>window.__pqrsCopied)).toEqual([expected]);
  expect(await page.evaluate(()=>window.__pqrsOpened)).toEqual([]);
  await expect(root.getByRole('status')).toContainText('no se ha creado ni modificado ninguna solicitud');
  await root.getByRole('button',{name:'Propietarios · Radicar PQRS'}).click();
  await expect(copy).toBeHidden();
});
