import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const OWNER='11111111-1111-4111-8111-111111111111';
const SESSION='22222222-2222-4222-8222-222222222222';
const STAFF='33333333-3333-4333-8333-333333333333';
const STAFF_SESSION='88888888-8888-4888-8888-888888888888';
const TARGET='persona@ejemplo.invalid';
const IDS=['44444444-4444-4444-8444-444444444444','55555555-5555-4555-8555-555555555555',
'66666666-6666-4666-8666-666666666666','77777777-7777-4777-8777-777777777777'];
const sql=readFileSync(new URL('../qa/database/supabase/migrations/20261118150000_qa_iam_managed_users.sql',import.meta.url),'utf8');
const command=(id,action,email=TARGET,name='Persona prueba',user=null,grants=[{project_id:'qa-01',role:'viewer'}],reason='Cambio aprobado')=>
 `select public.qa_iam_command('${OWNER}','${SESSION}','${id}','${action}','${email}','${name}',${user?"'"+user+"'":"null"},'${JSON.stringify(grants)}'::jsonb,'${reason}') as result`;
test('isolated IAM migration: only active admin with live session can invite, assign, suspend, audit',async()=>{
 const db=new PGlite();
 try{
 await db.exec(`create role anon;create role authenticated;create role supabase_auth_admin;
 create role service_role bypassrls;
 create schema auth;create schema qa_identity_private;
 create table auth.users(id uuid primary key,email text not null,email_confirmed_at timestamptz,banned_until timestamptz);
 create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id));
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claims',true)::jsonb->>'sub','')::uuid$$;
 create function auth.jwt() returns jsonb language sql stable as $$select current_setting('request.jwt.claims',true)::jsonb$$;
 create table public.projects(id text primary key);
 create table public.profiles(id uuid primary key,name text);
 create table public.memberships(project_id text references public.projects(id),
   user_id uuid references public.profiles(id),role text,primary key(project_id,user_id));
 create table qa_identity_private.principals(
  email text primary key,display_name text,application_role text,membership_role text,active boolean);
 insert into public.projects values ('qa-01'),('qa-02');
 insert into auth.users values ('${OWNER}','owner@ejemplo.invalid',now(),null),
 ('${STAFF}','${TARGET}',null,null);
 insert into auth.sessions values ('${SESSION}','${OWNER}'),('${STAFF_SESSION}','${STAFF}');
 insert into qa_identity_private.principals values
 ('owner@ejemplo.invalid','Owner','technical_admin','admin',true),
 ('segundo@ejemplo.invalid','Second','technical_admin','admin',false);
 `);
 await db.exec(sql);
 assert.equal((await db.query(`select public.qa_iam_is_operator('${OWNER}','${SESSION}') as allowed`)).rows[0].allowed,true);
 assert.equal((await db.query(`select public.qa_iam_is_operator('${OWNER}','${STAFF_SESSION}') as allowed`)).rows[0].allowed,false);
 assert.equal((await db.query(`select public.qa_iam_is_operator('${STAFF}','${STAFF_SESSION}') as allowed`)).rows[0].allowed,false);
 await assert.rejects(db.query(command(IDS[0],'prepare_invite','owner@ejemplo.invalid')),/IAM_PROTECTED_ADMIN/);
 const result=(await db.query(command(IDS[0],'prepare_invite'))).rows[0].result;
 assert.equal(result.action,'prepare_invite');
 assert.equal((await db.query(`select qa_identity_private.before_user_created('{"user":{"email":"${TARGET}"}}'::jsonb) as status`)).rows[0].status.error,undefined);
 assert.equal((await db.query(`select qa_identity_private.before_user_created('{"user":{"email":"outsider@ejemplo.invalid"}}'::jsonb) as status`)).rows[0].status.error.http_code,403);
 assert.deepEqual((await db.query(command(IDS[0],'prepare_invite'))).rows[0].result,result);
 await assert.rejects(db.query(command(IDS[0],'offboard')),/IAM_IDEMPOTENCY_CONFLICT/);
 await db.query(command(IDS[1],'link_invite',TARGET,'Persona prueba',STAFF));
 assert.equal((await db.query(`select count(*)::int as n from public.memberships where user_id='${STAFF}'`)).rows[0].n,1);
 await db.exec(`select set_config('request.jwt.claims','{"sub":"${STAFF}","aal":"aal2","session_id":"${STAFF_SESSION}"}',false)`);
 assert.equal((await db.query('select qa_identity_private.current_principal() as role')).rows[0].role,'managed_staff');
 await db.query(command(IDS[2],'suspend',TARGET));
 assert.equal((await db.query(`select count(*)::int as n from public.memberships where user_id='${STAFF}'`)).rows[0].n,0);
 assert.equal((await db.query('select qa_identity_private.current_principal() as role')).rows[0].role,null);
 await db.query(command(IDS[3],'confirm_auth_ban',TARGET));
 const audit=(await db.query(`select public.qa_iam_snapshot('${OWNER}','${SESSION}') as details`)).rows[0].details;
 assert.equal(audit.accounts.length,1);
 assert.equal(audit.accounts[0].status,'suspended');
 assert.ok(audit.audit.length>=4);
 await db.exec(`update qa_identity_private.principals set active=false where email='owner@ejemplo.invalid'`);
 await assert.rejects(db.query(command('99999999-9999-4999-8999-999999999999','offboard')),/IAM_NOT_AUTHORIZED/);
 }finally{await db.close();}
});
