import {test,expect} from '@playwright/test';

test('staff carousel shows assigned roles, honest missing functions, fallback and mobile layout',async({page})=>{
 await page.goto('./');
 await page.evaluate(async()=>{
  const {mountStaffDirectory}=await import('/adphor-platform/src/js/ui-staff-directory.js');
  document.body.replaceChildren();const root=document.createElement('main');root.id='staff-test';document.body.append(root);
  const repo={staffDirectory:async project=>[{id:'delegate-1',name:'Persona sintética QA',role_label:'Delegado de prueba',relationship:'delegate',functions:[],photo_path:null}],staffPhotoUrl:async()=>{throw Error('No photo');}};
  await mountStaffDirectory(root,{repo,projectId:'qa-a',projectName:'Copropiedad sintética QA'});
 });
 await expect(page.getByRole('heading',{name:'Equipo administrativo'})).toBeVisible();
 await expect(page.getByText('Delegado de prueba',{exact:true})).toBeVisible();
 await expect(page.getByText('Funciones específicas pendientes de registrar.',{exact:true})).toBeVisible();
 await expect(page.getByRole('list',{name:'Equipo de la copropiedad'})).toBeVisible();
 await expect(page.getByRole('img')).toHaveCount(0);
 await page.setViewportSize({width:390,height:844});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});

test('staff carousel decodes a photo and keeps initials when the image fails', async ({page}) => {
 await page.route('**/qa-synthetic-portrait.svg', route => route.fulfill({
  contentType: 'image/svg+xml',
  body: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><rect width="24" height="24" fill="blue"/></svg>',
 }));
 await page.route('**/qa-expired-portrait.svg', route => route.fulfill({status: 403}));
 for (const width of [1440, 390]) {
  await page.setViewportSize({width,height:844});
  await page.goto('./');
  await page.evaluate(async () => {
   const {mountStaffDirectory}=await import('/adphor-platform/src/js/ui-staff-directory.js');
   const root=document.createElement('main');
   document.body.replaceChildren(root);
   const repo={
    staffDirectory: async () => ['Foto válida','Foto vencida'].map((name,i) => ({
     id: String(i), name, role_label:'Delegado', relationship:'delegate', photo_path:'synthetic',
    })),
    staffPhotoUrl: async (_,id) => id==='0' ? '/qa-synthetic-portrait.svg' : '/qa-expired-portrait.svg',
   };
   await mountStaffDirectory(root,{repo,projectId:'qa-a'});
  });
  const photo=page.getByRole('img',{name:'Fotografía de Foto válida'});
  await expect(photo).toBeVisible();
  expect(await photo.evaluate(img=>img.complete && img.naturalWidth>0 && img.naturalHeight>0)).toBe(true);
  await expect(page.getByRole('listitem').filter({hasText:'Foto vencida'}).locator('.avatar')).toHaveText('Fv');
 }
});
