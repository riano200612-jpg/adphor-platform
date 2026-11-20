import {test,expect} from '@playwright/test';

test('GAUNTLET IAM: bearer and same-origin Access cookie reach only the protected QA endpoint',async({page})=>{
 await page.goto('./');
 await page.context().addCookies([{url:new URL(page.url()).origin,name:'QA_ACCESS_TEST',value:'synthetic-access-cookie',sameSite:'Lax'}]);
 let received=null;
 await page.route('**/api/iam',async(route)=>{
  const request=route.request();
  const headers=await request.allHeaders();
  received={url:request.url(),method:request.method(),cookie:headers.cookie||'',
    auth:headers.authorization||'',apiKey:headers.apikey};
  await route.fulfill({status:200,contentType:'application/json',
    body:JSON.stringify({enabled:true,accounts:[],audit:[]})});
 });
 const result=await page.evaluate(async()=>{
  const {createIamClient}=await import('/adphor-platform/src/js/services/iam-client.js');
  return createIamClient({getSession:async()=>({data:{session:{access_token:'synthetic-qa-bearer'}}})}).read();
 });
 expect(result).toEqual({enabled:true,accounts:[],audit:[]});
 expect(received?.url).toContain('/api/iam');
 expect(received?.method).toBe('GET');
 expect(received?.cookie).toContain('QA_ACCESS_TEST=synthetic-access-cookie');
 expect(received?.auth).toBe('Bearer synthetic-qa-bearer');
 expect(received?.apiKey).toBeUndefined();
});
test('GAUNTLET IAM: Access or MFA denial stays blocked; cookie alone grants nothing',async({page})=>{
 await page.goto('./');
 await page.context().addCookies([{url:new URL(page.url()).origin,name:'QA_ACCESS_TEST',value:'synthetic-access-cookie',sameSite:'Lax'}]);
 await page.route('**/api/iam',async(route)=>route.fulfill({
  status:403,contentType:'application/json',body:'{"error":"Operación no autorizada."}'
 }));
 const result=await page.evaluate(async()=>{
  const {createIamClient}=await import('/adphor-platform/src/js/services/iam-client.js');
  try{
   await createIamClient({getSession:async()=>({data:{session:{access_token:'synthetic-qa-bearer'}}})}).read();
   return 'UNSAFE_SUCCESS';
  }catch(e){return e.message;}
 });
 expect(result).not.toBe('UNSAFE_SUCCESS');
 expect(result).toContain('permiso administrativo general');
});
