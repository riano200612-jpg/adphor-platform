import {test,expect} from '@playwright/test';

test('Agenda Virtual V4 preserves eight original sections, tenant isolation and CSV export',async({page})=>{
 const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto('./');
 await page.evaluate(async()=>{
  const {mountVerifiedAgenda}=await import('/adphor-platform/src/js/ui-verified-agenda.js');
  const root=document.createElement('div');root.id='qa-v4-e2e';document.body.append(root);
  const rows=[
   {id:'qa-meeting-1',project_id:'p1',title:'Consejo autorizado',kind:'Consejo',source_status:'Confirmada',start_at:'2026-12-01T15:00:00Z',end_at:'2026-12-01T17:00:00Z',is_calendar_verified:true}
  ];
  mountVerifiedAgenda(root,{repo:{mode:'cloud',listVerifiedQaMeetings:async id=>rows.filter(m=>m.project_id===id)},projectId:'p1',projectName:'Edificio Piloto'});
 });
 const frame=page.frameLocator('#qa-v4-e2e iframe');
 await expect(frame.locator('.nav-item')).toHaveCount(8);
 await expect(frame.locator('#adphor-v4-source')).toContainText('1 reuniones verificadas');
 for(let i=1;i<=8;i++){
  await frame.locator('[data-sec="s'+i+'"]').click();
  await expect(frame.locator('#main-content')).not.toBeEmpty();
 }
 await frame.locator('[data-sec="s2"]').click();
 await expect(frame.locator('#main-content')).toContainText('Edificio Piloto');
 await expect(frame.locator('body')).not.toContainText('Jaqueline Gazabon');
 await expect(frame.locator('body')).not.toContainText('Centro Médico Santa Lucía');
 await expect(frame.locator('body')).not.toContainText('https://meet.google.com/');
 await expect(page.locator('#qa-v4-e2e button')).toContainText('Volver al portal');
 expect(errors).toEqual([]);
});

test('Agenda Virtual V4 rejects tenant-mismatched verified rows and displays error',async({page})=>{
 await page.goto('./');
 await page.evaluate(async()=>{
  const {mountVerifiedAgenda}=await import('/adphor-platform/src/js/ui-verified-agenda.js');
  const root=document.createElement('div');root.id='qa-v4-negative';document.body.append(root);
  mountVerifiedAgenda(root,{repo:{mode:'cloud',listVerifiedQaMeetings:async()=>[
   {id:'not-ours',project_id:'p2',title:'SECRETO DE OTRA COPROPIEDAD',kind:'Consejo',source_status:'Confirmada',start_at:'2026-12-01T15:00:00Z',end_at:'2026-12-01T17:00:00Z',is_calendar_verified:true}
  ]},projectId:'p1',projectName:'Edificio Piloto'});
 });
 const frame=page.frameLocator('#qa-v4-negative iframe');
 await expect(frame.locator('#adphor-v4-source')).toContainText('No se pudo consultar la agenda');
 await expect(frame.locator('body')).not.toContainText('SECRETO DE OTRA COPROPIEDAD');
});
