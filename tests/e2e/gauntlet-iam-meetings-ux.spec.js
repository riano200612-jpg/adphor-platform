import {test,expect} from '@playwright/test';

test('GAUNTLET: IAM technical check fail-closed and emits only a safe diagnostic',async({page})=>{
 await page.goto('./');
 const result=await page.evaluate(async()=>{
  const {verifyGeneralAdmin,corporateAccessNotice}=await import('/adphor-platform/src/js/services/delegate-scope.js');
  const states=[];
  const authorized=await verifyGeneralAdmin({read:async()=>{throw Error('secret bearer: must not be shown')}},
    {eligible:true,reportStatus:state=>states.push(state)});
  document.body.replaceChildren();
  const notice=document.createElement('p');
  notice.setAttribute('role','status');
  notice.textContent=corporateAccessNotice(states[0]);
  document.body.append(notice);
  return {authorized,states};
 });
 expect(result.authorized).toBe(false);
 expect(result.states).toEqual(['unavailable']);
 await expect(page.getByRole('status')).toContainText('Actualizar datos');
 await expect(page.getByRole('status')).not.toContainText('secret bearer');
});
test('GAUNTLET: positive operator snapshot does not change unrelated building privileges',async({page})=>{
 await page.goto('./');
 const states=await page.evaluate(async()=>{
  const {verifyGeneralAdmin,corporatePageAllowed}=await import('/adphor-platform/src/js/services/delegate-scope.js');
  const phases=[];
  const allowed=await verifyGeneralAdmin({read:async()=>({enabled:true,accounts:[],audit:[]})},
    {eligible:true,reportStatus:s=>phases.push(s)});
  return {allowed,phases,delegated:corporatePageAllowed('access-audit',false),
    general:corporatePageAllowed('access-audit',allowed)};
 });
 expect(states).toEqual({allowed:true,phases:['verified'],delegated:false,general:true});
});
