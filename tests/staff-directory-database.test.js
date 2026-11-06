import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

test('staff cards and private photographs require AAL2 and assigned property; client writes denied',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`create role anon;create role authenticated;create schema auth;create schema storage;
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   grant usage on schema auth,storage to authenticated;
   create table public.projects(id text primary key);
   create table public.memberships(project_id text,user_id uuid,role text);
   create function public.project_role(project text) returns text language sql stable security definer set search_path='' as $$select role from public.memberships where project_id=project and user_id=auth.uid() and current_setting('test.aal',true)='aal2'$$;
   create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
   create table storage.objects(bucket_id text,name text);alter table storage.objects enable row level security;grant select on storage.objects to authenticated;`);
  await db.exec(await readFile(new URL('../supabase/migrations/20261106210345_qa_staff_directory.sql',import.meta.url),'utf8'));
  const a='00000000-0000-4000-8000-000000000001',b='00000000-0000-4000-8000-000000000002';
  await db.exec(`insert into projects values('a'),('b');insert into memberships values('a','${a}','admin'),('b','${b}','admin');
   insert into qa_staff_members(id,name,role_code,role_label,active,photo_path,photo_sha256,source_sha256)
   values('delegate-1','Persona A','D','Delegado',true,'delegate-1/'||repeat('a',64)||'.jpg',repeat('a',64),repeat('c',64)),
   ('delegate-2','Persona B','D','Delegado',true,null,null,repeat('c',64)),('delegate-3','Inactivo','D','Delegado',false,null,null,repeat('c',64));
   insert into qa_staff_assignments values('a','delegate-1','delegate'),('b','delegate-2','delegate'),('a','delegate-3','support');
   insert into storage.objects values('qa-staff-photos','delegate-1/'||repeat('a',64)||'.jpg'),('qa-staff-photos','unregistered.jpg');
   set role authenticated;set request.jwt.claim.sub='${a}';set test.aal='aal1';`);
  assert.equal((await db.query('select * from qa_staff_directory')).rows.length,0);
  assert.equal((await db.query('select * from storage.objects')).rows.length,0);
  await db.exec("set test.aal='aal2'");
  assert.deepEqual((await db.query('select id from qa_staff_directory')).rows.map(r=>r.id),['delegate-1']);
  assert.equal((await db.query('select * from storage.objects')).rows.length,1);
  await assert.rejects(db.exec("update qa_staff_members set active=true"),/permission denied/);
  await db.exec(`set request.jwt.claim.sub='${b}'`);
  assert.deepEqual((await db.query('select id from qa_staff_directory')).rows.map(r=>r.id),['delegate-2']);
  assert.equal((await db.query('select * from storage.objects')).rows.length,0);
  await db.exec('reset role;set role anon');
  await assert.rejects(db.query('select * from qa_staff_directory'),/permission denied/);
 }finally{await db.close();}
});
