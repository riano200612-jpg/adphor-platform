import test from 'node:test';
import assert from 'node:assert/strict';
import {invokeQaCalendarAvailability} from '../src/js/services/qa-calendar-edge.js';
const begin='2026-11-16T10:00:00-05:00',end='2026-11-16T11:00:00-05:00';
test('browser invokes isolated QA function with selected property and validated freeBusy',async()=>{
 let invoked;
 const functions={invoke:async(name,options)=>{invoked={name,...options};return {data:{project_id:'p1',timezone:'America/Bogota',source:'google_freebusy',busy:[{start:begin,end}]},error:null};}};
 const busy=await invokeQaCalendarAvailability(functions,'p1',begin,end);
 assert.deepEqual(invoked,{name:'qa-calendar-availability',body:{project_id:'p1',start:begin,end}});
 assert.deepEqual(busy,[{start:begin,end}]);
});
test('browser rejects synthetic, cross-tenant, unverified, or unsuccessful results',async()=>{
 const fake=async data=>invokeQaCalendarAvailability({invoke:async()=>({data,error:null})},'p1',begin,end);
 for(const data of [{project_id:'p2',timezone:'America/Bogota',source:'google_freebusy',busy:[]},{project_id:'p1',timezone:'America/Bogota',busy:[]},{project_id:'p1',timezone:'America/Bogota',source:'synthetic',busy:[]}])await assert.rejects(fake(data));
 for(const [status,fragment] of [[401,/MFA AAL2/],[403,/MFA AAL2/],[503,/no está configurado/],[502,/No se pudo comprobar/]]){
  await assert.rejects(invokeQaCalendarAvailability({invoke:async()=>({error:{context:{status}}})},'p1',begin,end),fragment);
 }
});
