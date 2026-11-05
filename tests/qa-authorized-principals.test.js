import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

test('QA authorization rejects outsiders, unconfirmed users, AAL1 and role forgery', async()=>{
 const db=new PGlite();
 const owner='00000000-0000-0000-0000-000000000001';
 const auditor='00000000-0000-0000-0000-000000000002';
 const outsider='00000000-0000-0000-0000-000000000003';
 try {
 await db.exec(`create role anon;create role authenticated;create role supabase_auth_admin;
 create schema auth;create schema storage;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
 create function auth.uid() returns uuid language sql stable as $$select (current_setting('request.jwt.claims',true)::jsonb->>'sub')::uuid$$;
 create function auth.jwt() returns jsonb language sql stable as $$select current_setting('request.jwt.claims',true)::jsonb$$;
 grant usage on schema auth to authenticated;
 create table public.projects(id text primary key);
 create table public.profiles(id uuid primary key references auth.users(id),name text);
 create table public.memberships(project_id text references public.projects(id),user_id uuid references public.profiles(id),role text,primary key(project_id,user_id));
 create table storage.objects(id text);
 grant select on public.projects,public.profiles,public.memberships to authenticated;
 create policy fixture_projects on public.projects to authenticated using(true);
 create policy fixture_profiles on public.profiles to authenticated using(true);
 create policy fixture_memberships on public.memberships to authenticated using(true);
 insert into public.projects values('qa-a'),('qa-b');
 insert into auth.users values('${owner}','owner@example.invalid',now()),('${auditor}','auditor@example.invalid',null),('${outsider}','outsider@example.invalid',now());`);
 await db.exec(readFileSync(new URL('../qa/database/supabase/migrations/20261105144315_qa_authorized_principals.sql',import.meta.url),'utf8'));
 await db.exec(`insert into qa_identity_private.principals values
 ('owner@example.invalid','Technical owner','technical_admin','admin',true),
 ('auditor@example.invalid','Functional auditor','functional_admin_auditor','coordinator',true);`);
 assert.equal((await db.query('select qa_identity_private.provision_confirmed_users() as n')).rows[0].n,1);
 assert.equal((await db.query('select count(*)::int n from public.memberships')).rows[0].n,2);
 await db.exec(`update auth.users set email_confirmed_at=now() where id='${auditor}'`);
 assert.equal((await db.query('select qa_identity_private.provision_confirmed_users() as n')).rows[0].n,2);
 // Running provisioning again is safe and does not duplicate assignments.
 await db.exec('select qa_identity_private.provision_confirmed_users()');
 assert.equal((await db.query('select count(*)::int n from public.memberships')).rows[0].n,4);
 const as=async(id,aal)=>{
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:id,aal,user_metadata:{role:'admin',email:'owner@example.invalid'}})]);
  await db.exec('set role authenticated');
 };
 await db.exec(`grant usage on schema storage to authenticated;grant select on storage.objects to authenticated;alter table storage.objects enable row level security;create policy fixture_storage on storage.objects to authenticated using(public.project_role(id) is not null);insert into storage.objects values('qa-a');`);
 await as(owner,'aal1');assert.equal((await db.query('select * from storage.objects')).rows.length,0);assert.equal((await db.query('select * from public.projects')).rows.length,0);
 assert.equal((await db.query("select public.project_role('qa-a') as role")).rows[0].role,null);
 await as(owner,'aal2');assert.equal((await db.query('select * from storage.objects')).rows.length,1);assert.equal((await db.query("select public.project_role('qa-a') as role")).rows[0].role,'admin');
 await as(auditor,'aal2');assert.equal((await db.query("select public.project_role('qa-a') as role")).rows[0].role,'coordinator');
 await assert.rejects(db.query("update public.memberships set role='admin' where user_id=$1",[auditor]));
 await assert.rejects(db.query('select * from qa_identity_private.principals'));
 await assert.rejects(db.query('select qa_identity_private.provision_confirmed_users()'));
 await as(outsider,'aal2');assert.equal((await db.query('select * from storage.objects')).rows.length,0);assert.equal((await db.query('select * from public.projects')).rows.length,0);
 await db.exec('reset role');
 const rejected=await db.query(`select qa_identity_private.before_user_created('{"user":{"email":"outsider@example.invalid"}}') as result`);
 assert.equal(rejected.rows[0].result.error.http_code,403);
 const allowed=await db.query(`select qa_identity_private.before_user_created('{"user":{"email":"AUDITOR@example.invalid"}}') as result`);
 assert.deepEqual(allowed.rows[0].result,{});
 await db.exec("update qa_identity_private.principals set active=false where email='auditor@example.invalid'");
 await as(auditor,'aal2');assert.equal((await db.query('select * from public.projects')).rows.length,0);
 } finally {await db.close();}
});
