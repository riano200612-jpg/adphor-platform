import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

test('private media SQL isolates approved metadata and objects; clients cannot grant access',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`create role anon;create role authenticated;create schema auth;create schema storage;
   create table auth.users(id uuid primary key);
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   grant usage on schema auth,storage to authenticated;
   create table public.projects(id text primary key);
   create table public.memberships(project_id text,user_id uuid,role text);
   create function public.project_role(project text) returns text language sql stable security definer set search_path='' as $$select role from public.memberships where project_id=project and user_id=auth.uid()$$;
   create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
   create table storage.objects(bucket_id text,name text);alter table storage.objects enable row level security;grant select on storage.objects to authenticated;`);
  const draft=await readFile(new URL('../docs/sql/qa-private-media-draft.sql',import.meta.url),'utf8');
  await db.exec(draft.replace(/rollback;\s*$/,'commit;'));
  const a='00000000-0000-4000-8000-000000000001',b='00000000-0000-4000-8000-000000000002';
  await db.exec(`insert into auth.users values('${a}'),('${b}');insert into projects values('a'),('b');
   insert into memberships values('a','${a}','admin'),('b','${b}','admin');
   insert into qa_property_photos values('a','1',repeat('a',64),'building.jpg',true,'${a}',now()),('b','2',repeat('b',64),'building.jpg',true,'${b}',now());
   insert into qa_project_companions values('a','staff-1','Persona QA','GG','Gerencia',repeat('a',64),'staff.jpg',true,'${a}',now()),('a','staff-2','Sin aprobación','A','Apoyo',repeat('b',64),'pending.jpg',false,null,null);
   insert into storage.objects values('property-photos','a/building.jpg'),('property-photos','b/building.jpg'),('staff-photos','a/staff.jpg'),('staff-photos','a/pending.jpg'),('property-photos','a/unregistered.jpg');
   set role authenticated;set request.jwt.claim.sub='${a}';`);
  assert.equal((await db.query('select * from qa_property_photos')).rows.length,1);
  assert.equal((await db.query('select * from qa_project_companions')).rows.length,1);
  assert.deepEqual((await db.query('select name from storage.objects order by name')).rows.map(x=>x.name),['a/building.jpg','a/staff.jpg']);
  await assert.rejects(()=>db.exec("update qa_project_companions set approved=true"),/permission denied/);
  await db.exec(`set request.jwt.claim.sub='${b}';`);
  assert.equal((await db.query('select * from qa_project_companions')).rows.length,0);
  assert.deepEqual((await db.query('select name from storage.objects')).rows.map(x=>x.name),['b/building.jpg']);
 }finally{await db.close();}
});
