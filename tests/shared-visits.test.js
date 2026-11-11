import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {createSharedVisitRepository} from '../src/js/services/shared-visits.js';
test('shared QA visit SQL persists, retries, isolates membership and requires AAL2',async()=>{
 const db=new PGlite();
 try{
 await db.exec(`create role anon;create role authenticated;create schema auth;create schema qa_identity_private;
 grant usage on schema auth,qa_identity_private to authenticated;
 create function auth.uid() returns uuid language sql stable as $$select current_setting('test.uid')::uuid$$;
 create function auth.jwt() returns jsonb language sql stable as $$select jsonb_build_object('aal',current_setting('test.aal'))$$;
 create function qa_identity_private.current_principal() returns text language sql stable as $$select case when auth.jwt()->>'aal'='aal2' then 'admin' end$$;
 create table auth.users(id uuid primary key);insert into auth.users values('00000000-0000-0000-0000-000000000001');
 create table projects(id text primary key);insert into projects values('p1'),('p2');
 create table memberships(project_id text,user_id uuid,role text,primary key(project_id,user_id));
 insert into memberships values('p1','00000000-0000-0000-0000-000000000001','admin');
 create function project_role(project text) returns text language sql stable security definer set search_path='' as $$select role from public.memberships where project_id=project and user_id=auth.uid() and qa_identity_private.current_principal() is not null$$;
 select set_config('test.uid','00000000-0000-0000-0000-000000000001',false);select set_config('test.aal','aal2',false);`);
 await db.exec(readFileSync(new URL('../qa/sql/shared-visits.sql',import.meta.url),'utf8'));
 await db.exec('set role authenticated');
 const args=['p1','11111111-1111-4111-8111-111111111111','00000000-0000-0000-0000-000000000001','Visita sintética aislada','2026-11-14T10:00:00-05:00'];
 const save=(a=args)=>db.query('select * from qa_create_visit($1,$2,$3,$4,$5)',a);
 const first=await save();const retry=await save();
 assert.equal(first.rows[0].request_id,retry.rows[0].request_id);
 assert.equal((await db.query('select * from qa_visits')).rows.length,1);
 await assert.rejects(save([...args.slice(0,3),'Contenido distinto',args[4]]),/Conflicto/);
 await assert.rejects(save(['p2',...args.slice(1)]),/no autorizada/);
 await db.exec("select set_config('test.aal','aal1',false)");
 assert.equal((await db.query('select * from qa_visits')).rows.length,0);
 await assert.rejects(save(),/no autorizada/);
 await db.exec("select set_config('test.aal','aal2',false)");
 await assert.rejects(db.exec('delete from qa_visits'),/permission denied/);
 assert.equal((await db.query('select * from qa_visits')).rows.length,1);
 }finally{await db.close();}
});
test('shared visit adapter is disabled outside exact QA and rejects AAL1 before any query',async()=>{
 assert.equal(createSharedVisitRepository({}, {url:'https://oqizvirqjwbbhyyjpthq.supabase.co'}),null);
 const repo=createSharedVisitRepository({auth:{mfa:{getAuthenticatorAssuranceLevel:async()=>({data:{currentLevel:'aal1'}})}}},{url:'https://qfctnnnnltghepwujpdm.supabase.co',writesEnabled:true});
 await assert.rejects(repo.list('p1'),/AAL2/);
 await assert.rejects(repo.save({projectId:'p1'}),/AAL2/);
});

test('shared visit adapter passes the scoped request to RPC and validates its identity',async()=>{
 let rpcPayload;
 const chain={select(){return this;},eq(){return this;},limit:async()=>({data:[{role:'admin'}]})};
 const client={auth:{mfa:{getAuthenticatorAssuranceLevel:async()=>({data:{currentLevel:'aal2'}})},getUser:async()=>({data:{user:{id:'actor'}}})},from:()=>chain,
  rpc:async(name,payload)=>{assert.equal(name,'qa_create_visit');rpcPayload=payload;return {data:{request_id:payload.p_request,project_id:payload.p_project}};}};
 const repo=createSharedVisitRepository(client,{url:'https://qfctnnnnltghepwujpdm.supabase.co',writesEnabled:true});
 const saved=await repo.save({projectId:'p1',requestId:'request',responsibleId:'actor',kind:'Visita',start:'2026-11-14T10:00'});
 assert.equal(saved.project_id,'p1');assert.equal(rpcPayload.p_scheduled,'2026-11-14T10:00-05:00');
 client.rpc=async()=>({data:{request_id:'other',project_id:'p2'}});
 await assert.rejects(repo.save({projectId:'p1',requestId:'request',responsibleId:'actor',kind:'Visita',start:'2026-11-14T10:00'}),/no válida/);
});

 test('shared visit writes default to disabled and never call Auth or RPC',async()=>{
 const repo=createSharedVisitRepository({}, {url:'https://qfctnnnnltghepwujpdm.supabase.co'});
 assert.equal(repo.writesEnabled,false);
 await assert.rejects(repo.save({projectId:'p1'}),/deshabilitado/);
 });
