import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {delegateAdminLabel,corporatePageAllowed,verifyGeneralAdmin} from '../src/js/services/delegate-scope.js';

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
