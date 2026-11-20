import {test,expect} from '@playwright/test';

test('GAUNTLET: stalled meetings reader leaves visible plain-language retry instead of infinite spinner',async({page})=>{
 await page.goto('./');
 await page.evaluate(async()=>{
  const {readWithinDeadline,qaMeetingReadFeedback}=await import('/adphor-platform/src/js/services/qa-readonly-deadline.js');
  document.body.replaceChildren();
  const panel=document.createElement('section');
  panel.setAttribute('aria-label','Reuniones verificadas');
  const status=document.createElement('p');
  status.setAttribute('role','status');
  status.textContent='Consultando reuniones…';
  panel.append(status);document.body.append(panel);
  try {
   await readWithinDeadline(()=>new Promise(()=>{}),{timeoutMs:30});
  } catch(error) {
   status.textContent=qaMeetingReadFeedback(error);
  }
 });
 await expect(page.getByRole('status')).toContainText('La consulta de reuniones está tardando');
 await expect(page.getByRole('status')).toContainText('Actualizar datos');
 await expect(page.getByRole('status')).not.toContainText('Consultando reuniones…');
});
test('GAUNTLET: successful read keeps the actual meeting count and does not invent dates',async({page})=>{
 await page.goto('./');
 const response=await page.evaluate(async()=>{
  const {readWithinDeadline}=await import('/adphor-platform/src/js/services/qa-readonly-deadline.js');
  return readWithinDeadline(()=>Promise.resolve([{id:'synthetic',project_id:'qa'}]),{timeoutMs:500});
 });
 expect(response).toHaveLength(1);
 expect(response[0]).toEqual({id:'synthetic',project_id:'qa'});
});
