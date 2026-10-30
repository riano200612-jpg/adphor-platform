import {test,expect} from '@playwright/test';
test('selector component: 40 synthetic properties, filtering and safe names',async({page})=>{
 await page.goto('./');
 await page.evaluate(async()=>{
  const {mountProjectSelector}=await import('/adphor-platform/src/js/ui-project-selector.js');
  const root=document.createElement('div');root.id='selector-fixture';document.body.append(root);
  const projects=Array.from({length:40},(_,i)=>({id:`qa-${i+1}`,name:`Copropiedad ficticia ${i+1}`}));
  projects[0].name='<img src=x onerror=alert(1)>';
  mountProjectSelector(root,{projects,selected:'qa-1',onChange:id=>{root.dataset.selected=id;}});
 });
 const root=page.locator('#selector-fixture');
 await expect(root.locator('option')).toHaveCount(40);
 await expect(root.locator('img')).toHaveCount(0);
 await root.getByLabel('Buscar copropiedad').fill('40');
 await expect(root.locator('option')).toHaveCount(2);
 await root.locator('select').selectOption('qa-40');
 await expect(root).toHaveAttribute('data-selected','qa-40');
 await root.getByLabel('Buscar copropiedad').fill('ninguna');
 await expect(root.locator('select')).toHaveValue('qa-40');
 await expect(root.getByRole('status')).toContainText('0 coincidencias');
});

test('application: 40 synthetic memberships, navigation, reload and restricted user',async({page})=>{
 const projects=Array.from({length:40},(_,i)=>({id:`qa-${i+1}`,name:`Jardín Ficticio ${i+1}`,type:'QA',location:'Sintética',areas:['Área QA']}));
 const seeds=Object.fromEntries(projects.map((p,i)=>[p.id,[{id:`case-${i+1}`,fecha:'2026-10-29T12:00:00Z',descripcion:`Caso exclusivo ${p.id}`,area:'Área QA',estado:'Pendiente'}]]));
 await page.route('**/src/js/data/adphorData.js*',route=>route.fulfill({status:200,contentType:'application/javascript',body:`export const PROJECTS=${JSON.stringify(projects)};export const SEED_MINUTAS=${JSON.stringify(seeds)};`}));
 const login=async(profile='admin-demo')=>{
  await page.locator('[name=profile]').selectOption(profile);
  await page.getByRole('button',{name:'Explorar demostración'}).click();
  await expect(page.locator('#project-select')).toBeVisible();
 };
 await page.goto('./');await login();
 await expect(page.locator('#project-select option')).toHaveCount(40);
 await page.getByLabel('Buscar copropiedad').fill('JARDIN FICTICIO 40');
 await page.locator('#project-select').selectOption('qa-40');
 await page.getByRole('button',{name:'Bitácora',exact:true}).click();
 await expect(page.locator('#project-select')).toHaveValue('qa-40');
 await expect(page.locator('.ticket-card')).toHaveCount(1);
 await expect(page.locator('.ticket-card')).toContainText('Caso exclusivo qa-40');
 await page.getByRole('button',{name:'Informes',exact:true}).click();
 await expect(page.locator('#project-select')).toHaveValue('qa-40');
 await page.reload();await login();
 await expect(page.locator('#project-select')).toHaveValue('qa-40');
 await page.getByRole('button',{name:'Cerrar sesión',exact:true}).click();
 await page.evaluate(()=>sessionStorage.setItem('adphor.selected-project:viewer-demo','qa-40'));
 await login('viewer-demo');
 await expect(page.locator('#project-select option')).toHaveCount(1);
 await expect(page.locator('#project-select')).toHaveValue('qa-1');
 await page.getByRole('button',{name:'Bitácora',exact:true}).click();
 await expect(page.locator('.ticket-card')).toContainText('Caso exclusivo qa-1');
 await expect(page.locator('.ticket-card')).not.toContainText('Caso exclusivo qa-40');
 await page.setViewportSize({width:390,height:844});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
