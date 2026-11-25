import {test,expect} from '../../qa/isolated-browser-test.js';

test('verified Google meeting appears in history and calendar grid after reload; pending Meet refreshes on same event',async({page,baseURL})=>{
 const eventId='0123456789abcdefghijklmnopqrstuv0123456789abcdefghij';
 const event={projectId:'source-28',idempotencyKey:'a'.repeat(64),googleEventId:eventId,
  status:'meet_pending',meetLink:null,summary:'[ADPHOR QA] Reunión persistida',title:'[ADPHOR QA] Reunión persistida',
  start:new Date(Date.now()+24*3600000).toISOString(),end:new Date(Date.now()+25*3600000).toISOString()};
 let rows=[event];
 await page.exposeFunction('readMeetingFixture',async()=>rows);
 await page.exposeFunction('refreshMeetingFixture',async(projectId,key)=>{
  expect(projectId).toBe('source-28');expect(key).toBe(event.idempotencyKey);
  rows=[{...event,status:'created',meetLink:'https://meet.google.com/abc-defg-hij'}];
  return rows[0];
 });
 const fixture=new URL('meeting-calendar-persistence-fixture',baseURL).href;
 const moduleUrl=new URL('src/js/ui-meeting-assessment.js',baseURL).href;
 await page.route('**/meeting-calendar-persistence-fixture',route=>route.fulfill({contentType:'text/html',body:`<!doctype html>
  <html lang="es"><meta name="viewport" content="width=device-width,initial-scale=1"><main id="meetings"></main>
  <script type="module">import {mountMeetingAssessment} from '${moduleUrl}';
  mountMeetingAssessment(document.querySelector('#meetings'),{projectId:'source-28',projectName:'Entrelagos',
   role:'admin',repo:{mode:'cloud',calendarBookingEnabled:true,createGoogleCalendarMeeting:async()=>{},
   listGoogleCalendarMeetings:()=>window.readMeetingFixture(),
   refreshGoogleCalendarMeeting:(project,key)=>window.refreshMeetingFixture(project,key),
   listVerifiedQaMeetings:async()=>[]}});</script></html>`}));
 await page.goto(fixture);
 await expect(page.locator('[data-list]')).toContainText(eventId);
 await expect(page.locator('[data-list]')).toContainText('MEET_PENDING');
 await expect(page.locator('.calendar-grid .calendar-day small').filter({hasText:'[ADPHOR QA] Reunión persistida'})).toHaveCount(1);
 const dayLabel=await page.locator('.calendar-grid .calendar-day').filter({hasText:'[ADPHOR QA] Reunión persistida'}).getAttribute('aria-label');
 expect(dayLabel).toContain('1 reuniones verificadas');
 await page.getByRole('button',{name:'Comprobar enlace de Meet'}).click();
 await expect(page.locator('[data-list]')).toContainText('Abrir Google Meet');
 await expect(page.locator('[data-list]')).toContainText(eventId);
 await page.reload();
 await expect(page.locator('[data-list]')).toContainText('Abrir Google Meet');
 await expect(page.locator('[data-list]')).toContainText(eventId);
 await expect(page.locator('.calendar-grid .calendar-day small').filter({hasText:'[ADPHOR QA] Reunión persistida'})).toHaveCount(1);
});

test('uncertain remote result stays visible after reload without exposing an unconfirmed Google ID',async({page,baseURL})=>{
 const eventId='0123456789abcdefghijklmnopqrstuv0123456789abcdefghij';
 const event={projectId:'source-28',idempotencyKey:'b'.repeat(64),googleEventId:eventId,status:'reconciling',meetLink:null,
  summary:'[ADPHOR QA] Resultado pendiente',title:'[ADPHOR QA] Resultado pendiente',
  start:new Date(Date.now()+24*3600000).toISOString(),end:new Date(Date.now()+25*3600000).toISOString()};
 await page.exposeFunction('readMeetingFixture',async()=>[event]);
 await page.exposeFunction('refreshMeetingFixture',async()=>event);
 const fixture=new URL('meeting-calendar-reconciling-fixture',baseURL).href;
 const moduleUrl=new URL('src/js/ui-meeting-assessment.js',baseURL).href;
 await page.route('**/meeting-calendar-reconciling-fixture',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><html lang="es"><meta name="viewport" content="width=device-width,initial-scale=1"><main id="meetings"></main>
 <script type="module">import {mountMeetingAssessment} from '${moduleUrl}';mountMeetingAssessment(document.querySelector('#meetings'),{projectId:'source-28',projectName:'Entrelagos',role:'admin',repo:{mode:'cloud',calendarBookingEnabled:true,
 createGoogleCalendarMeeting:async()=>{},listGoogleCalendarMeetings:()=>window.readMeetingFixture(),refreshGoogleCalendarMeeting:(project,key)=>window.refreshMeetingFixture(project,key),listVerifiedQaMeetings:async()=>[]}});</script></html>`}));
 await page.goto(fixture);
 await expect(page.locator('[data-list]')).toContainText('RESULTADO PENDIENTE');
 await expect(page.locator('[data-list]')).not.toContainText(eventId);
 await expect(page.locator('.calendar-grid .calendar-day small').filter({hasText:'[ADPHOR QA] Resultado pendiente'})).toHaveCount(0);
 await page.reload();
 await expect(page.locator('[data-list]')).toContainText('RESULTADO PENDIENTE');
 await expect(page.locator('[data-list]')).not.toContainText(eventId);
});

test('late verified QA agenda response from former property is discarded',async({page,baseURL})=>{
 const fixture=new URL('meeting-calendar-stale-tenant-fixture',baseURL).href;
 const moduleUrl=new URL('src/js/ui-meeting-assessment.js',baseURL).href;
 await page.route('**/meeting-calendar-stale-tenant-fixture',route=>route.fulfill({contentType:'text/html',body:`<!doctype html>
  <html lang="es"><meta name="viewport" content="width=device-width,initial-scale=1">
  <main id="meetings"></main><script type="module">
  import {mountMeetingAssessment} from '${moduleUrl}';
  window.__activeProject='source-28';window.__qaStarted=false;
  mountMeetingAssessment(document.querySelector('#meetings'),{
    projectId:'source-28',projectName:'Entrelagos',role:'admin',
    isProjectCurrent:()=>window.__activeProject==='source-28',
    repo:{mode:'cloud',calendarBookingEnabled:false,verifiedCalendarEnabled:true,
      listVerifiedQaMeetings:()=>new Promise(resolve=>{
        window.__qaResolve=resolve;window.__qaStarted=true;
      })}});
  </script></html>`}));
 await page.goto(fixture);
 await page.waitForFunction(()=>window.__qaStarted===true);
 await page.evaluate(()=>{
   window.__activeProject='source-29';
   const start=new Date(Date.now()+86400000).toISOString();
   const end=new Date(Date.now()+90000000).toISOString();
   window.__qaResolve([{id:'8ed75956-34a9-4f0a-959f-68e6f1eb0441',
     project_id:'source-28',title:'Reunión exclusiva de edificio anterior',
     is_calendar_verified:true,source_status:'Confirmada',start_at:start,end_at:end}]);
 });
 await page.waitForTimeout(150);
 await expect(page.locator('[data-list]')).not.toContainText('Reunión exclusiva de edificio anterior');
 await expect(page.locator('.calendar-grid .calendar-day small').filter({hasText:'Reunión exclusiva de edificio anterior'})).toHaveCount(0);
});
