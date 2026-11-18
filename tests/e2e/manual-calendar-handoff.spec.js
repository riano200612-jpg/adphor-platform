import {test,expect} from '../../qa/isolated-browser-test.js';
import {bogotaInput} from '../../src/js/ui-meeting-experience.js';
test('authorized cloud QA meeting: manual Google draft and tentative ICS; no booking',async({page,baseURL})=>{
 const fixture=new URL('manual-calendar-handoff-fixture',baseURL).href;
 const moduleUrl=new URL('src/js/ui-meeting-assessment.js',baseURL).href;
 await page.route('**/manual-calendar-handoff-fixture',route=>route.fulfill({contentType:'text/html',body:
  '<!doctype html><html lang="es"><main id="meetings"></main><script type="module">'+
  "import {mountMeetingAssessment} from '"+moduleUrl+"';"+
  "mountMeetingAssessment(document.querySelector('#meetings'),{projectId:'p1',projectName:'QA Aislada',role:'admin',members:[],repo:{mode:'cloud',verifiedCalendarEnabled:false,calendarAvailabilityConfigured:false,assessMeeting:async()=>{throw Error('Must not book');}}});"+
  '</script></html>'
 }));
 await page.goto(fixture);
 await page.locator('[data-schedule]').click();
 await page.getByLabel('Asunto',{exact:true}).fill('Consejo manual QA');
 const next=page.getByRole('button',{name:'Continuar',exact:true});
 await next.click();
 const start=new Date(Date.now()+72*3600000);start.setUTCSeconds(0,0);
 const end=new Date(+start+3600000);
 await page.getByLabel('Inicio',{exact:true}).fill(bogotaInput(start));
 await page.getByLabel('Fin',{exact:true}).fill(bogotaInput(end));
 await next.click();await next.click();await next.click();
 await expect(page.getByRole('heading',{name:'Entrega manual a Google Calendar'})).toBeVisible();
 await page.evaluate(()=>{window.open=url=>{window.__manualUrl=url;return null;};});
 await page.getByRole('button',{name:'Abrir borrador en Google Calendar'}).click();
 const url=new URL(await page.evaluate(()=>window.__manualUrl));
 expect(url.origin).toBe('https://calendar.google.com');
 expect(url.searchParams.get('action')).toBe('TEMPLATE');
 const dl=page.waitForEvent('download');
 await page.getByRole('button',{name:'Descargar evento provisional .ics'}).click();
 expect((await dl).suggestedFilename()).toBe('adphor-reunion-pendiente.ics');
 await expect(page.getByText('Ninguna reunión se ha confirmado automáticamente.',{exact:false})).toBeVisible();
});
