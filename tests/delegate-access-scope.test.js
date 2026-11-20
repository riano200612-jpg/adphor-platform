import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {delegateAdminLabel,corporatePageAllowed,verifyGeneralAdmin,corporateAccessNotice} from '../src/js/services/delegate-scope.js';

test('local admin is labeled delegated administrator of the building, not global admin',()=>{
  assert.equal(delegateAdminLabel(false),'Delegado · Administrador de copropiedad');
  assert.equal(delegateAdminLabel(true),'Administrador general');
  assert.equal(delegateAdminLabel('true'),'Delegado · Administrador de copropiedad');
});

test('corporate pages cannot be opened by building admins, including manually routed pages',()=>{
  for(const page of ['qa-source','access-audit']){
    assert.equal(corporatePageAllowed(page,false),false);
    assert.equal(corporatePageAllowed(page,undefined),false);
    assert.equal(corporatePageAllowed(page,'true'),false);
    assert.equal(corporatePageAllowed(page,true),true);
  }
  for(const page of ['dashboard','meetings','visits','pqrs','reports']){
    assert.equal(corporatePageAllowed(page,false),true);
  }
});

test('general administration is attested only by a successful server IAM response',async()=>{
  let calls=0;
  const good={read:async()=>{calls++;return {enabled:true,accounts:[],audit:[]};}};
  assert.equal(await verifyGeneralAdmin(good,{eligible:false}),false);
  assert.equal(calls,0);
  assert.equal(await verifyGeneralAdmin(good,{eligible:true}),true);
  assert.equal(calls,1);
  for(const result of [null,{}, {enabled:true},{enabled:'true',accounts:[],audit:[]},{enabled:true,accounts:{},audit:[]}]){
    assert.equal(await verifyGeneralAdmin({read:async()=>result},{eligible:true}),false);
  }
  assert.equal(await verifyGeneralAdmin({read:async()=>{throw Error('403 FORBIDDEN');}},{eligible:true}),false);
  assert.equal(await verifyGeneralAdmin({read:async()=>{throw Error('503 DISABLED');}},{eligible:true}),false);
  assert.equal(await verifyGeneralAdmin(null,{eligible:true}),false);
});

test('QA application applies server-verified privilege on navigation, routes and logout',()=>{
 const app=readFileSync(new URL('../src/js/app.js',import.meta.url),'utf8');
 assert.match(app,/state\.corporateAdmin\s*=\s*await verifyGeneralAdmin\(repo\.iam/);
 assert.match(app,/corporatePageAllowed\(state\.page,\s*state\.corporateAdmin\)/);
 assert.match(app,/role\(\)==='admin'\s*&&\s*state\.corporateAdmin\)\s*nav\.push\(\['access-audit'/);
 assert.match(app,/role\(\)==='admin'\s*&&\s*state\.corporateAdmin\)\s*nav\.push\(\['qa-source'/);
 assert.match(app,/state\.corporateAdmin\s*=\s*false/);
});

test('GAUNTLET: IAM reports a safe status while preserving denial on an invalid backend response',async()=>{
  const statuses=[];
  const allow=await verifyGeneralAdmin({read:async()=>({enabled:true,accounts:[],audit:[]})},{eligible:true,reportStatus:x=>statuses.push(x)});
  assert.equal(allow,true);assert.deepEqual(statuses,['verified']);
  const invalid=[];
  assert.equal(await verifyGeneralAdmin({read:async()=>({enabled:true,accounts:{},audit:[]})},
    {eligible:true,reportStatus:x=>invalid.push(x)}),false);
  assert.deepEqual(invalid,['unverified']);
  const failed=[];
  assert.equal(await verifyGeneralAdmin({read:async()=>{throw Error('network token secret SHOULD NOT APPEAR');}},
    {eligible:true,reportStatus:x=>failed.push(x)}),false);
  assert.deepEqual(failed,['unavailable']);
  const message=corporateAccessNotice('unavailable');
  assert.match(message,/Actualizar datos/);
  assert.doesNotMatch(message,/network|token|secret/i);
  assert.equal(corporateAccessNotice('not-eligible'),'');
  assert.equal(corporateAccessNotice('verified'),'');
});
test('GAUNTLET dashboard never blocks navigation behind a meeting read-only spinner',()=>{
 const app=readFileSync(new URL('../src/js/app.js',import.meta.url),'utf8');
 assert.match(app,/meetingCard\.textContent = 'Abrir Reuniones para consultar'/);
 assert.match(app,/status\.textContent = 'Puedes abrir Reuniones para consultar la agenda/);
 assert.doesNotMatch(app,/meetingCard\.textContent = 'Consultando reuniones…'/);
 assert.match(app,/readWithinDeadline\(\(\)=>repo\.listVerifiedQaMeetings\(projectId\)\)/);
 assert.match(app,/reportStatus:status=>\{state\.iamStatus=status;\}/);
 assert.match(app,/corporateAccessNotice\(state\.iamStatus\)/);
});
