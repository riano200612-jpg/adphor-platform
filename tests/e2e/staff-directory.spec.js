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
