// Isolated browser fixture: exercises the real UI with explicit synthetic Calendar responses.
// Does not certify Supabase AAL2, OAuth, or corporate Calendar availability.
import {test,expect} from '../../qa/isolated-browser-test.js';
import {bogotaInput} from '../../src/js/ui-meeting-experience.js';
async function openFixture(page,baseURL,provider){
 await page.exposeFunction('readFixtureAvailability',provider);
 const fixture=new URL('meeting-suggestions-fixture',baseURL).href;
 const moduleUrl=new URL('src/js/ui-meeting-assessment.js',baseURL).href;
 await page.route('**/meeting-suggestions-fixture',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><html lang="es"><meta name="viewport" content="width=device-width,initial-scale=1"><main id="meetings"></main><script type="module">import {mountMeetingAssessment} from '${moduleUrl}';mountMeetingAssessment(document.querySelector('#meetings'),{projectId:'p1',projectName:'Copropiedad sintética aislada',role:'admin',members:[],repo:{mode:'cloud',meetingAvailability:window.readFixtureAvailability,listVerifiedQaMeetings:async()=>[]}});</script></html>`}));
 await page.goto(fixture);
 await page.locator('[data-schedule]').click();
 await page.getByLabel('Asunto',{exact:true}).fill('Consulta sintética sin reserva');
 await page.getByRole('button',{name:'Continuar',exact:true}).click();
 const initial=new Date(Date.now()+72*3600000);initial.setUTCSeconds(0,0);
 const end=new Date(+initial+3600000);
 await page.getByLabel('Inicio',{exact:true}).fill(bogotaInput(initial));
 await page.getByLabel('Fin',{exact:true}).fill(bogotaInput(end));
 return initial;
}
test('suggestions preserve explicit duration, scope, revalidation and non-booking labels',async({page,baseURL})=>{
 const calls=[];
 const initial=await openFixture(page,baseURL,async(...args)=>{calls.push(args);return [];});
 await page.getByRole('button',{name:'Sugerir otros horarios',exact:true}).click();
 const alternatives=page.getByRole('region',{name:'Alternativas de horario'});
 await expect(alternatives.getByRole('button')).toHaveCount(5);
 await expect(alternatives).toContainText('No son reservas');
 await expect(alternatives).toContainText('No verifican jornada laboral ni disponibilidad de acompañantes');
 expect(calls[0][0]).toBe('p1');
 expect(Date.parse(calls[0][2])-Date.parse(calls[0][1])).toBe(50*3600000);
 await alternatives.getByRole('button').first().click();
 await expect(page.getByLabel('Inicio',{exact:true})).toHaveValue(bogotaInput(new Date(+initial+1800000)));
 await expect(page.getByLabel('Fin',{exact:true})).toHaveValue(bogotaInput(new Date(+initial+5400000)));
 await expect(alternatives.getByRole('button')).toHaveCount(0);
 const review=page.getByRole('button',{name:'Revisar solicitud de reunión',exact:true});
 await expect(review).toBeHidden();
 await page.getByRole('button',{name:'Verificar horario en Google Calendar',exact:true}).click();
 await expect(review).toBeVisible();
 await page.getByLabel('Inicio',{exact:true}).fill(bogotaInput(new Date(+initial+3600000)));
 await expect(review).toBeHidden();
});
test('provider failure and obsolete responses never leave selectable alternatives',async({page,baseURL})=>{
 let resolve,fail=false;
 const initial=await openFixture(page,baseURL,async()=>{
  if(fail)throw Error('synthetic provider failure');
  return new Promise(done=>{resolve=done;});
 });
 const suggest=page.getByRole('button',{name:'Sugerir otros horarios',exact:true});
 const alternatives=page.getByRole('region',{name:'Alternativas de horario'});
 await suggest.click();
 await expect.poll(()=>Boolean(resolve)).toBe(true);
 await page.getByLabel('Inicio',{exact:true}).fill(bogotaInput(new Date(+initial+1800000)));
 resolve([]);
 await expect(suggest).toBeEnabled();
 await expect(alternatives.getByRole('button')).toHaveCount(0);
 fail=true;
 await suggest.click();
 await expect(alternatives).toContainText('No se generaron sugerencias');
 await expect(alternatives.getByRole('button')).toHaveCount(0);
 await expect(page.getByText('synthetic provider failure')).toHaveCount(0);
});

test('obsolete suggestion finally cannot enable controls owned by a newer manual check',async({page,baseURL})=>{
 const pending=[];
 const initial=await openFixture(page,baseURL,async()=>new Promise(resolve=>pending.push(resolve)));
 const suggest=page.getByRole('button',{name:'Sugerir otros horarios',exact:true});
 const verify=page.getByRole('button',{name:'Verificar horario en Google Calendar',exact:true});
 const alternatives=page.getByRole('region',{name:'Alternativas de horario'});
 await suggest.click();await expect.poll(()=>pending.length).toBe(1);
 await expect(verify).toBeDisabled();
 await page.getByLabel('Inicio',{exact:true}).fill(bogotaInput(new Date(+initial+1800000)));
 await expect(verify).toBeEnabled();await verify.click();
 await expect.poll(()=>pending.length).toBe(2);
 pending[0]([]);
 await expect(verify).toBeDisabled();await expect(suggest).toBeDisabled();
 await expect(alternatives.getByRole('button')).toHaveCount(0);
 pending[1]([]);
 await expect(verify).toBeEnabled();await expect(suggest).toBeEnabled();
 await expect(page.getByRole('button',{name:'Revisar solicitud de reunión',exact:true})).toBeVisible();
});
test('manual verification rejects timezone-free busy data instead of showing available',async({page,baseURL})=>{
 await openFixture(page,baseURL,async()=>[{start:'2026-11-14T15:00:00',end:'2026-11-14T16:00:00'}]);
 await page.getByRole('button',{name:'Verificar horario en Google Calendar',exact:true}).click();
 await expect(page.getByRole('status')).toHaveAttribute('data-availability','CONSULTA_FALLIDA');
 await expect(page.getByRole('button',{name:'Revisar solicitud de reunión',exact:true})).toBeHidden();
});
