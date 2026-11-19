import {test,expect} from '@playwright/test';
test('review proposals UI is explicit about no task creation and protects against self review',async({page})=>{
 await page.goto('./');
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.evaluate(async()=>{
  const {mountQaTaskCatalog}=await import('/src/js/ui-task-catalog.js');
  const root=document.createElement('div');root.id='qa-catalog-test';document.body.append(root);
  const entries=[];
  const repo={
   async listQaTaskCandidates(){return entries.map(r=>({...r}));},
   async proposeQaTaskCandidate(project,payload){
    entries.push({...payload,project_id:project,created_by:'reviewer-a',status:'proposed',created_at:'2026-11-19'});
   },
   async reviewQaTaskCandidate(){throw Error('No self approval');}
  };
  mountQaTaskCatalog(root,{repo,projectId:'p1',projectName:'QA sintética',userId:'reviewer-a'});
 });
 const root=page.locator('#qa-catalog-test');
 await expect(root.getByRole('heading',{name:'Propuestas de actividades recurrentes'})).toBeVisible();
 await root.locator('[name=title]').fill('Actividad de prueba <script>');
 await root.locator('[name=cadence]').selectOption('daily');
 await root.getByRole('button',{name:'Presentar propuesta (sin programar)'}).click();
 await expect(root).toContainText('Actividad de prueba <script>');
 await expect(root).toContainText('Pendiente de otra persona autorizada');
 await expect(root.getByRole('button',{name:'Revisar para diseño'})).toHaveCount(0);
 await expect(root).toContainText('NO activa tareas');
 expect(errors).toEqual([]);
});
test('review controls require a different reviewer and reason; re-render on decision',async({page})=>{
 await page.goto('./');
 await page.evaluate(async()=>{
  const {mountQaTaskCatalog}=await import('/src/js/ui-task-catalog.js');
  const root=document.createElement('div');root.id='qa-catalog-review';document.body.append(root);
  let value={id:'candidate-1',project_id:'p1',created_by:'author',title:'Verificación propuesta',
   cadence:'monthly',status:'proposed',description:'Sin programación',created_at:'2026-11-19'};
  const repo={async listQaTaskCandidates(){return [value];},
    async proposeQaTaskCandidate(){},async reviewQaTaskCandidate(_p,_id,decision,note){
      value={...value,status:decision,review_note:note};
    }};
  mountQaTaskCatalog(root,{repo,projectId:'p1',userId:'reviewer'});
 });
 const root=page.locator('#qa-catalog-review');
 const submit=root.getByRole('button',{name:'Revisar para diseño'});
 await expect(submit).toBeVisible();
 await submit.click();
 await expect(root).toContainText('No se registró la decisión');
 await root.locator('[name=note]').fill('Revisar requisitos y documentar catálogo');
 await submit.click();
 await expect(root).toContainText('Revisada para diseño (sin activar)');
 await expect(root.getByRole('button',{name:'Revisar para diseño'})).toHaveCount(0);
});
