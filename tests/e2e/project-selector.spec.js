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
