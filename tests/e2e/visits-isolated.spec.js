import {test,expect} from '../../qa/isolated-browser-test.js';
import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';


test('Chromium can open a page before loading Vite or SQL',async({page})=>{
 await page.goto('about:blank');
 await page.setContent('<h1>Browser ready</h1>');
 await expect(page.getByRole('heading',{name:'Browser ready'})).toBeVisible();
});

test('shared scheduled-visit contract: review, confirmation and SQL lookup after reload in isolation',async({page,baseURL},testInfo)=>{
 const moduleUrl=new URL('src/js/ui-visit-preparation.js',baseURL).href;
 const stylesheet=new URL('src/css/visits.css',baseURL).href;
 const response=await page.request.get(moduleUrl);
 expect(response.ok(),'Vite module HTTP status').toBeTruthy();
 expect(response.headers()['content-type'],'Vite module MIME type').toMatch(/javascript/);
 const db=new PGlite();
 try {
  await db.exec(`
   create role anon;
   create role authenticated;
   create schema auth;
   grant usage on schema auth to authenticated;
   create function auth.uid() returns uuid language sql stable as $$
     select '00000000-0000-0000-0000-000000000001'::uuid $$;
   create function auth.jwt() returns jsonb language sql stable as $$ select '{"aal":"aal2"}'::jsonb $$;
   create table auth.users(id uuid primary key);insert into auth.users values('00000000-0000-0000-0000-000000000001');
   create table projects(id text primary key);insert into projects values('p1'),('p2');
   create schema qa_identity_private;grant usage on schema qa_identity_private to authenticated;
   create function qa_identity_private.current_principal() returns text language sql stable as $$select case when auth.jwt()->>'aal'='aal2' then 'admin' end$$;
   create table memberships(project_id text,user_id uuid,role text,primary key(project_id,user_id));
   create function public.project_role(project text) returns text language sql stable security definer set search_path='' as $$select role from public.memberships where project_id=project and user_id=auth.uid() and qa_identity_private.current_principal() is not null$$;
   grant select on memberships to authenticated;
   insert into memberships values ('p1',auth.uid(),'admin');
  `);
  await db.exec(readFileSync(new URL('../../qa/sql/shared-visits.sql',import.meta.url),'utf8'));
  await db.exec('set role authenticated');
  const repository={
   save:async({projectId,requestId,responsibleId,kind,start})=>(await db.query('select * from public.qa_create_visit($1,$2,$3,$4,$5)',[projectId,requestId,responsibleId,kind,start+'-05:00'])).rows[0],
   list:async projectId=>(await db.query('select * from public.qa_visits where project_id=$1',[projectId])).rows
  };
  await page.exposeFunction('saveIsolatedVisit',draft=>repository.save(draft));
  await page.exposeFunction('listIsolatedVisits',()=>repository.list('p1'));
  await page.route('**/visits-isolated-fixture',route=>route.fulfill({contentType:'text/html',body:`
   <!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="${stylesheet}"><div id="visit"></div>
   <script type="module">
    import {mountVisitPreparation} from '${moduleUrl}';
    mountVisitPreparation(document.querySelector('#visit'),{
      projectId:'p1',projectName:'Copropiedad de prueba',
      members:[{project_id:'p1',user_id:'00000000-0000-0000-0000-000000000001',name:'Responsable de prueba'},
       {project_id:'p2',user_id:'other',name:'Persona ajena'}],
      projects:Array.from({length:43},(_,i)=>({id:'p'+(i+1),name:'Copropiedad '+(i+1)})),
      onProjectChange:()=>{},
      visitRepository:{save:window.saveIsolatedVisit,list:window.listIsolatedVisits}
    });

   </script>`}));
  await page.goto('./visits-isolated-fixture');
  await expect(page.getByRole('heading',{name:'Visitas',exact:true})).toBeVisible();
  await page.getByRole('searchbox',{name:'Buscar copropiedad'}).fill('Copropiedad 43');
  await expect(page.locator('#visit-project-select option')).toHaveCount(2);
  const review=page.getByRole('button',{name:'Revisar visita'});
  await expect(review).toBeDisabled();
  await page.getByText('Miss ADPHOR · Guía de Visitas').click();
  await expect(page.getByText('Indica el tipo o motivo de la visita.')).toBeVisible();
  await page.getByLabel('Tipo o motivo').fill('Inspección de prueba');
  await page.getByLabel('Fecha y hora (Colombia)').fill('2026-11-14T10:00');
  const responsible=page.locator('#visit select[name="responsible"]');
  const responsibleFilter=page.locator('#visit select[data-visit-responsible]');
  await expect(responsible).toHaveCount(1);
  await expect(responsibleFilter).toHaveCount(1);
  await expect(responsible.locator('option')).toHaveCount(2);
  await responsible.selectOption({label:'Responsable de prueba'});
  await expect(responsibleFilter).toHaveValue('');
  await responsibleFilter.selectOption({label:'Responsable de prueba'});
  await expect(responsible).toHaveValue('00000000-0000-0000-0000-000000000001');
  await responsibleFilter.selectOption('');
  await expect(responsible).toHaveValue('00000000-0000-0000-0000-000000000001');
  await review.click();
  const save=page.getByRole('button',{name:'Confirmar y registrar visita'});
  await expect(save).toBeVisible();
  await page.getByLabel('Tipo o motivo').fill('Inspección revisada');
  await expect(save).toBeHidden();
  await review.click();
  await save.click();
  await expect(page.getByText('Programación de visita guardada en SQL. No registra ejecución, ingreso ni salida.')).toBeVisible();
  const [saved]=await repository.list('p1');
  expect(saved.motive).toBe('Inspección revisada');
  const retry=await repository.save({projectId:'p1',requestId:saved.request_id,responsibleId:saved.responsible_id,kind:saved.motive,start:'2026-11-14T10:00'});
  expect(retry.request_id).toBe(saved.request_id);
  expect(await repository.list('p1')).toHaveLength(1);
  await page.reload();
  await expect(page.locator('[data-visit-results]')).toContainText(saved.request_id);
  const afterReload=await repository.list('p1');
  expect(afterReload).toHaveLength(1);
  expect(afterReload[0].request_id).toBe(saved.request_id);
  await page.screenshot({path:testInfo.outputPath('visits-desktop.png'),fullPage:true});
  await page.getByRole('searchbox',{name:'Buscar visitas'}).fill('sin coincidencia');
  await expect(page.getByText('Ninguna visita coincide con los filtros.')).toBeVisible();
  await page.getByRole('searchbox',{name:'Buscar visitas'}).fill('');
  await page.setViewportSize({width:390,height:850});
  await expect(page.getByRole('heading',{name:'Preparar visita'})).toBeVisible();
  expect(await page.locator('body').evaluate(body=>body.scrollWidth)).toBeLessThanOrEqual(390);
  await expect(page.locator('[data-visit-results]')).toContainText(saved.request_id);
  await page.screenshot({path:testInfo.outputPath('visits-mobile.png'),fullPage:true});
  expect(await repository.list('p1')).toHaveLength(1);
 } finally {await db.close();}
});
