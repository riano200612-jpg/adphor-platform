import {test,expect} from '../../qa/isolated-browser-test.js';

const fixture=async(page,baseURL,role='admin')=>{
 const url=new URL('qa-calendar-probe-fixture',baseURL).href;
 const moduleUrl=new URL('src/js/ui-qa-calendar-probe.js',baseURL).href;
 await page.route('**/qa-calendar-probe-fixture',route=>route.fulfill({
  contentType:'text/html',
  body:`<!doctype html><html lang="es"><meta name="viewport" content="width=device-width, initial-scale=1">
  <body><main id="probe"></main><script type="module">
  import {mountQaCalendarProbe} from '${moduleUrl}';
  window.qaProbeMode='success';window.qaCalls=[];window.qaCurrent=true;
  const repo={mode:'cloud',qaCalendarEdgeEnabled:true,calendarAvailabilityConfigured:true,
   meetingAvailability:async(project,start,end)=>{
    window.qaCalls.push({project,start,end});
    if(window.qaProbeMode==='unconfigured')throw Error('El calendario corporativo aún no está configurado en QA.');
    if(window.qaProbeMode==='denied')throw Error('La consulta requiere autorización y MFA AAL2.');
    if(window.qaProbeMode==='broken')throw Error('jwt-private-document event details');
    if(window.qaProbeMode==='pending')return new Promise(resolve=>window.qaResolve=resolve);
    return [{start:new Date(Date.parse(start)+900000).toISOString(),
      end:new Date(Date.parse(start)+1800000).toISOString(),
      summary:'Other customer PRIVATE',organizer:'personal@example.com'}];
   }};
  mountQaCalendarProbe(document.querySelector('#probe'),{
   repo,projectId:'p1',role:'${role}',isProjectCurrent:()=>window.qaCurrent
  });</script></body></html>`
 }));
 await page.goto(url);
};

test('Admin may probe true Edge contract without creating a calendar event or leaking guest detail',async({page,baseURL},testInfo)=>{
 await fixture(page,baseURL);
 const check=page.getByRole('button',{name:'Comprobar conexión Google Calendar'});
 await expect(check).toBeEnabled();
 await expect(page.getByRole('status')).toContainText('No se ha ejecutado');
 await check.click();
 await expect(page.getByRole('status')).toContainText('respuesta de Google Calendar freeBusy');
 await expect(page.getByRole('status')).toContainText('no se creó ni cambió ningún evento');
 await expect(page.getByRole('status')).toContainText('no certifica todavía la cuenta organizadora');
 await expect(page.getByText('Other customer PRIVATE')).toHaveCount(0);
 const calls=await page.evaluate(()=>window.qaCalls);
 expect(calls).toHaveLength(1);
 expect(calls[0].project).toBe('p1');
 expect(Date.parse(calls[0].end)-Date.parse(calls[0].start)).toBe(3600000);
 await page.screenshot({path:testInfo.outputPath('calendar-probe-admin-desktop.png'),fullPage:true});
 await page.setViewportSize({width:390,height:850});
 await expect(check).toBeVisible();
 await page.screenshot({path:testInfo.outputPath('calendar-probe-admin-mobile.png'),fullPage:true});
});

test('QA-only diagnostic distinguishes missing OAuth, access denial and provider failure',async({page,baseURL})=>{
 await fixture(page,baseURL);
 const check=page.getByRole('button',{name:'Comprobar conexión Google Calendar'});
 await page.evaluate(()=>window.qaProbeMode='unconfigured');
 await check.click();
 await expect(page.getByRole('status')).toContainText('respondió 503');
 await expect(page.getByRole('status')).not.toContainText('intervalo(s) ocupado(s)');
 await page.evaluate(()=>window.qaProbeMode='denied');
 await check.click();
 await expect(page.getByRole('status')).toContainText('MFA AAL2');
 await page.evaluate(()=>window.qaProbeMode='broken');
 await check.click();
 await expect(page.getByRole('status')).toContainText('No se pudo confirmar');
 await expect(page.getByRole('status')).not.toContainText('jwt-private-document');
});

test('Other roles cannot invoke calendar probe or see diagnostic actions',async({page,baseURL})=>{
 await fixture(page,baseURL,'viewer');
 await expect(page.getByRole('button',{name:'Comprobar conexión Google Calendar'})).toHaveCount(0);
 expect(await page.evaluate(()=>window.qaCalls.length)).toBe(0);
});

test('Pending response cannot be shown after the current property becomes inactive',async({page,baseURL})=>{
 await fixture(page,baseURL);
 const check=page.getByRole('button',{name:'Comprobar conexión Google Calendar'});
 await page.evaluate(()=>window.qaProbeMode='pending');
 await check.click();
 await expect(page.getByRole('status')).toContainText('Verificando el servicio');
 await page.evaluate(()=>{window.qaCurrent=false;window.qaResolve([]);});
 await expect(page.getByRole('status')).not.toContainText('respuesta de Google Calendar freeBusy');
});
