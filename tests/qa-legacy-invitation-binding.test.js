import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const oldMigration=readFileSync(new URL('../qa/database/supabase/migrations/20261119173000_qa_legacy_user_candidates.sql',import.meta.url),'utf8');
const sql=readFileSync(new URL('../qa/database/supabase/migrations/20261119191500_qa_legacy_invitation_binding.sql',import.meta.url),'utf8');
const A='11111111-1111-4111-8111-111111111111';
const S='22222222-2222-4222-8222-222222222222';
const U='33333333-3333-4333-8333-333333333333';
const U2='44444444-4444-4444-8444-444444444444';
async function setup(){
 const db=new PGlite();
 await db.exec([
  'create role anon; create role authenticated; create role service_role bypassrls;',
  'create schema auth; create schema qa_identity_private;',
  'create table auth.users(id uuid primary key,email text,banned_until timestamptz);',
  'create table public.qa_staff_members(id text primary key,name text,active boolean);',
  'create table qa_identity_private.principals(email text primary key);',
  "create table qa_identity_private.iam_accounts(email text primary key,display_name text,status text,user_id uuid);",
  'create table qa_identity_private.iam_audit(event_id bigint generated always as identity primary key,request_id uuid unique not null,actor_id uuid not null,session_id uuid not null,action text not null,target_email text not null,reason text not null,input jsonb not null,result jsonb not null,occurred_at timestamptz default now());',
  "create function public.qa_iam_is_operator(u uuid,s uuid) returns boolean language sql stable as $$ select u='11111111-1111-4111-8111-111111111111'::uuid and s='22222222-2222-4222-8222-222222222222'::uuid $$;",
  "insert into public.qa_staff_members values('s1','Persona QA',true),('s2','Empleado bloqueado',true),('s3','Empleado en baja',false);",
  "insert into auth.users values('"+A+"','admin@example.invalid',null),('"+U+"','personal@example.invalid',null),('"+U2+"','otra@example.invalid',null);",
  "insert into qa_identity_private.iam_accounts values('personal@example.invalid','Persona QA','active','"+U+"'),('otra@example.invalid','Empleado bloqueado','active','"+U2+"');"
 ].join('\n'));
 await db.exec(oldMigration);
 await db.exec(sql);
 await db.exec("insert into qa_identity_private.legacy_user_candidates(legacy_id,username,display_name,legacy_role_code,legacy_status,qa_staff_id,review_classification) values ('1','j.guzman','Persona QA','D','Activo','s1','MATCHED'),('2','x.bloqueado','Empleado bloqueado','D','Bloqueado','s2','BLOCKED'),('3','x.baja','Empleado en baja','D','Activo','s3','MATCHED');");
 return db;
}
const eligible=(actor,session,alias,name)=>"select public.qa_iam_legacy_eligible('"+actor+"','"+session+"','"+alias+"','"+name+"') as ok";
const bind=(alias,user=U,mail='personal@example.invalid',name='Persona QA',request='55555555-5555-4555-8555-555555555555',actor=A,session=S)=>
 "select public.qa_iam_legacy_link_invite('"+actor+"','"+session+"','"+request+"','"+alias+"','"+mail+"','"+user+"','"+name+"','Autorización de prueba registrada') as result";
test('legacy binding requires admin and matched active staff before invitation',async()=>{
 const db=await setup();
 try{
  assert.equal((await db.query(eligible(A,S,'j.guzman','Persona QA'))).rows[0].ok,true);
  for(const alias of ['x.bloqueado','x.baja','fake.alias']){
   assert.equal((await db.query(eligible(A,S,alias,'Persona QA'))).rows[0].ok,false);
   await assert.rejects(db.query(bind(alias)),/IAM_LEGACY_NOT_ELIGIBLE/);
  }
  await assert.rejects(db.query(eligible(U,S,'j.guzman','Persona QA')),/IAM_NOT_AUTHORIZED/);
  await assert.rejects(db.query(bind('j.guzman',U,'personal@example.invalid','Persona QA','66666666-6666-4666-8666-666666666666',U)),/IAM_NOT_AUTHORIZED/);
 }finally{await db.close();}
});
test('eligible alias attaches once to exact invited Auth user but stays INVITED not ACTIVE',async()=>{
 const db=await setup();
 try{
  const first=(await db.query(bind('j.guzman'))).rows[0].result;
  assert.deepEqual(first,{status:'legacy_invited',alias:'j.guzman',email:'personal@example.invalid',auth_linked:true,active:false});
  const same=(await db.query(bind('j.guzman'))).rows[0].result;
  assert.deepEqual(same,first);
  const row=(await db.query("select username,activation_state,auth_user_id from qa_identity_private.legacy_user_candidates where username='j.guzman'")).rows[0];
  assert.equal(row.activation_state,'INVITED');assert.equal(row.auth_user_id,U);
  assert.equal((await db.query("select count(*)::int n from qa_identity_private.iam_audit")).rows[0].n,1);
  await assert.rejects(db.query(bind('j.guzman',U,'personal@example.invalid','Persona QA','66666666-6666-4666-8666-666666666666')),/IAM_LEGACY_NOT_ELIGIBLE/);
 }finally{await db.close();}
});
test('email or identity mismatch never binds, and browser roles lack RPC grants',async()=>{
 const db=await setup();
 try{
  for(const [mail,user,name] of [['otra@example.invalid',U,'Persona QA'],['personal@example.invalid',U2,'Persona QA'],['personal@example.invalid',U,'Wrong Name']]){
   await assert.rejects(db.query(bind('j.guzman',user,mail,name)),/IAM_LEGACY_(ACCOUNT_MISMATCH|NOT_ELIGIBLE)/);
  }
  assert.equal((await db.query("select count(*)::int n from qa_identity_private.legacy_user_candidates where auth_user_id is not null")).rows[0].n,0);
  const p=(await db.query("select has_function_privilege('authenticated','public.qa_iam_legacy_eligible(uuid,uuid,text,text)','EXECUTE') as eligible,has_function_privilege('authenticated','public.qa_iam_legacy_link_invite(uuid,uuid,uuid,text,text,uuid,text,text)','EXECUTE') as bind")).rows[0];
  assert.equal(p.eligible,false);assert.equal(p.bind,false);
 }finally{await db.close();}
});
