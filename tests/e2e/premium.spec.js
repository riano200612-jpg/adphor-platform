import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs/promises';
const folder='qa/visual-premium';
async function login(page){await page.goto('./');await page.getByRole('button',{name:'Explorar demostración'}).click();await expect(page.locator('#project-select')).toBeVisible();}
async function capture(page,name){await fs.mkdir(folder,{recursive:true});await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:`${folder}/after-${name}.png`,fullPage:true});}
async function a11y(page,name){const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();await fs.writeFile(`${folder}/axe-${name}.json`,JSON.stringify({url:page.url(),violations:result.violations,incomplete:result.incomplete},null,2));expect(result.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))).toEqual([]);}
async function next(page){await page.getByRole('button',{name:'Continuar',exact:true}).click();}
test('premium desktop: visual evidence, navigation and WCAG automated checks',async({page})=>{
 await page.goto('./');await capture(page,'login');await a11y(page,'login');
 await page.getByRole('button',{name:'Explorar demostración'}).click();await capture(page,'dashboard');await a11y(page,'dashboard');
 for(const [button,name]of [['Copropiedades','properties'],['Reuniones','meetings'],['PQRS','pqrs'],['Historial del enjambre','agents'],['Informes','reports']]){
 await page.getByRole('button',{name:button,exact:true}).click();await capture(page,name);await a11y(page,name);}
});
test('premium meetings: guided booking, timezone, reschedule, cancellation and local reload',async({page})=>{
 await login(page);await page.getByRole('button',{name:'Reuniones',exact:true}).click();
 await expect(page.locator('.calendar-day')).toHaveCount(42);await page.getByRole('button',{name:'Semana',exact:true}).click();await expect(page.locator('.calendar-day')).toHaveCount(7);
 await page.getByRole('button',{name:'+ Agendar reunión',exact:true}).click();await next(page);await expect(page.locator('[name=subject]')).toBeVisible();
 await page.locator('[name=subject]').fill('Consejo sintético QA');await next(page);
 const date=new Date(Date.now()+7*86400000).toISOString().slice(0,10);
 await page.locator('[name=start]').fill(date+'T09:00');await page.locator('[name=duration]').fill('1');await next(page);
 await page.locator('[name=delegate]').fill('Delegado ficticio');await page.locator('[name=attendees]').fill('Equipo sintético');await next(page);await next(page);
 await expect(page.locator('.wizard-review')).toContainText('Solo este navegador');await capture(page,'meeting-review');await a11y(page,'meeting-review');
 await page.getByRole('button',{name:'Confirmar en calendario local'}).click();await expect(page.locator('.meeting-list')).toContainText('Consejo sintético QA');
 await expect(page.locator('.meeting-list')).toContainText('9:00');
 await page.reload();await page.getByRole('button',{name:'Explorar demostración'}).click();await page.getByRole('button',{name:'Reuniones',exact:true}).click();await expect(page.locator('.meeting-list')).toContainText('Consejo sintético QA');
 await page.getByRole('button',{name:'Reprogramar',exact:true}).click();await expect(page.locator('[name=subject]')).toHaveValue('Consejo sintético QA');await next(page);await page.locator('[name=start]').fill(date+'T11:00');await page.locator('[name=end]').fill(date+'T12:00');await next(page);await expect(page.locator('[name=delegate]')).toHaveValue('Delegado ficticio');await next(page);await next(page);await page.getByRole('button',{name:'Confirmar en calendario local'}).click();await expect(page.locator('.meeting-list')).toContainText('11:00');
 page.once('dialog',d=>d.dismiss());await page.getByRole('button',{name:'Cancelar',exact:true}).click();await expect(page.locator('.meeting-list')).toContainText('Agendada (demo)');
 page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Cancelar',exact:true}).click();await expect(page.locator('.meeting-list')).toContainText('Cancelada');
});
test('premium PQRS: visible submit, receipt, persisted local case, response disclosure and error without fake success',async({page})=>{
 await login(page);await page.getByRole('button',{name:'PQRS',exact:true}).click();await expect(page.getByRole('button',{name:'+ Nueva PQRS'})).toBeVisible();
 await page.locator('[name=subject]').fill('Solicitud sintética');await page.locator('textarea[name=description]').fill('Descripción de prueba sin datos personales');await page.locator('[name=tower]').fill('Torre QA');
 await page.getByRole('button',{name:'Enviar solicitud PQRS'}).click();await expect(page.locator('.pqrs-message')).toContainText('Radicado:');await expect(page.locator('.pqrs-message')).toContainText('No se modificó PostgreSQL');await expect(page.locator('.pqrs-cases')).toContainText('Solicitud sintética');
 await page.getByText('Responder y gestionar caso',{exact:true}).click();await page.getByLabel('Respuesta',{exact:true}).fill('Respuesta sintética');await page.getByRole('button',{name:'Guardar respuesta',exact:true}).click();await capture(page,'pqrs-saved');await a11y(page,'pqrs-saved');
 await page.reload();await page.getByRole('button',{name:'Explorar demostración'}).click();await page.getByRole('button',{name:'PQRS',exact:true}).click();await expect(page.locator('.pqrs-cases')).toContainText('Solicitud sintética');
 await page.evaluate(()=>{Storage.prototype.setItem=()=>{throw Error('Almacenamiento no disponible');};});await page.locator('[name=subject]').fill('Conservar borrador');await page.locator('textarea[name=description]').fill('Conservar descripción');await page.getByRole('button',{name:'Enviar solicitud PQRS'}).click();await expect(page.locator('.pqrs-message')).toContainText('Almacenamiento no disponible');await expect(page.locator('[name=subject]')).toHaveValue('Conservar borrador');await capture(page,'pqrs-error');
});
test('premium mobile: 390px, reduced motion, catalog search, modules and visible controls',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});await page.goto('./');await capture(page,'mobile-login');await login(page);
 for(const [button,name]of [['Resumen','dashboard'],['Copropiedades','properties'],['Reuniones','meetings'],['PQRS','pqrs'],['Historial del enjambre','agents'],['Informes','reports']]){await page.getByRole('button',{name:button,exact:true}).click();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await capture(page,'mobile-'+name);await a11y(page,'mobile-'+name);}
 await page.getByRole('button',{name:'Copropiedades',exact:true}).click();await page.getByLabel('Buscar en el catálogo').fill('no existe');await expect(page.locator('.catalog-grid')).toContainText('No encontramos');
});
