import {test,expect} from '@playwright/test';

test('QA session guard survives reload and expires at ten minutes without touch',async({page})=>{
 await page.goto('./');
 const result=await page.evaluate(async()=>{
  const {createQaIdleGuard,expiredStoredSession,QA_IDLE_LIMIT_MS}=await import('/adphor-platform/src/js/services/qa-idle-session.js');
  let t=100000,expired=0,timer=0;
  const storage={data:new Map(),getItem(k){return this.data.get(k)||null;},setItem(k,v){this.data.set(k,v);},removeItem(k){this.data.delete(k);}};
  const guard=createQaIdleGuard({storage,now:()=>t,onExpire:()=>expired++,
    schedule:()=>++timer,cancel:()=>{}});
  guard.start('synthetic-person',{fresh:true});
  t+=600000-1;
  const active=guard.start('synthetic-person'); // navigation must not reset
  t++;
  guard.check();
  const ended=expiredStoredSession(storage,t,QA_IDLE_LIMIT_MS);
  guard.start('synthetic-person',{fresh:true});
  return {active,expired,ended,fresh:!expiredStoredSession(storage,t,QA_IDLE_LIMIT_MS)};
 });
 expect(result).toEqual({active:true,expired:1,ended:true,fresh:true});
});

test('PQRS offers only simple required fields; optional details and unavailable evidence are explicit',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('./');
 await page.evaluate(async()=>{
  const {mountPqrs}=await import('/adphor-platform/src/js/ui-pqrs.js');
  const root=document.createElement('main');root.id='qa-pqrs-saturday';document.body.append(root);
  mountPqrs(root,{projectId:'synthetic-project',projectName:'Copropiedad sintética',
    repository:{localDemo:true,list:async()=>[],create:async()=>({id:'QA-PQRS-SAT',status:'open'})}});
 });
 const root=page.locator('#qa-pqrs-saturday');
 await expect(root.getByText('Solo necesitas elegir el tipo')).toBeVisible();
 await expect(root.locator('[name=subject]')).toBeVisible();
 await expect(root.locator('[name=description]')).toBeVisible();
 await expect(root.locator('[name=tower]')).toBeHidden();
 await expect(root.locator('[name=evidence]')).toBeDisabled();
 await expect(root).toContainText('Puedes enviar la PQRS sin archivos');
 await root.getByText('Agregar torre, apartamento o nombre (opcional)').click();
 await expect(root.locator('[name=tower]')).toBeVisible();
 await root.locator('[name=subject]').fill('Solicitud de iluminación');
 await root.locator('[name=description]').fill('La luz del pasillo no funciona');
 await root.getByRole('button',{name:'Enviar solicitud PQRS'}).click();
 await expect(root.locator('[role=status]').first()).toContainText('QA-PQRS-SAT');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth)).toBeLessThanOrEqual(2);
});

test('Visitas offers examples and makes write permissions explicit',async({page})=>{
 await page.goto('./');
 await page.evaluate(async()=>{
  const {mountVisitPreparation}=await import('/adphor-platform/src/js/ui-visit-preparation.js');
  const root=document.createElement('main');root.id='qa-visits-saturday';document.body.append(root);
  mountVisitPreparation(root,{projectId:'synthetic-project',projectName:'Propiedad sintética',
   projects:[{id:'synthetic-project',name:'Propiedad sintética'}],members:[
     {project_id:'synthetic-project',user_id:'user',name:'Delegado autorizado',role:'admin'}],
   visitRepository:{list:async()=>[],lifecycleEnabled:true},canCreate:false});
 });
 const root=page.locator('#qa-visits-saturday');
 await expect(root.getByRole('heading',{name:'Preparar visita'})).toBeVisible();
 await expect(root).toContainText('selecciona el motivo, la fecha y la persona responsable');
 await expect(root.locator('#visit-kind-suggestions option')).toHaveCount(5);
 await expect(root.getByText('Puedes consultar visitas. Para programar una nueva')).toBeVisible();
 await expect(root.getByRole('button',{name:'Revisar visita'})).toBeDisabled();
 await expect(root.locator('[name=responsible] option')).toHaveCount(2);
});
