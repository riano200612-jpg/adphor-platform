import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

test('evidence proposal enforces ownership, stored object, case linkage, quota and tenant isolation',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`create role anon;create role authenticated;create schema auth;create schema storage;
   create table auth.users(id uuid primary key);
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   grant usage on schema auth,storage to authenticated;
   create table projects(id text primary key);create table memberships(project_id text,user_id uuid,role text);
   create function project_role(project text) returns text language sql stable security definer set search_path='' as $$select role from public.memberships where project_id=project and user_id=auth.uid()$$;
   create table pilot_pqrs(id uuid primary key,project_id text);create table tickets(id uuid primary key,project_id text);
   grant select on pilot_pqrs,tickets to authenticated;
   create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
   create table storage.objects(bucket_id text,name text);alter table storage.objects enable row level security;grant select,insert on storage.objects to authenticated;`);
  const draft=await readFile(new URL('../docs/sql/qa-evidence-enabled-draft.sql',import.meta.url),'utf8');
  await db.exec(draft.replace(/rollback;\s*$/,'commit;'));
  const a='00000000-0000-4000-8000-000000000001',b='00000000-0000-4000-8000-000000000002',c='10000000-0000-4000-8000-000000000001';
  await db.exec(`insert into auth.users values('${a}'),('${b}');insert into projects values('a'),('b');
   insert into memberships values('a','${a}','admin'),('b','${b}','admin');insert into pilot_pqrs values('${c}','a');
   set role authenticated;set request.jwt.claim.sub='${a}';`);
  async function attach(n,{stored=true,owner=a,project='a'}={}){
   const id=`20000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
   const path=`${project}/pqrs/${c}/${owner}/${id}.pdf`;
   if(stored)await db.query('insert into storage.objects values($1,$2)',['qa-case-evidence',path]);
   await db.query('insert into qa_case_evidence(id,project_id,case_id,case_kind,storage_bucket,storage_path,media_type,file_bytes,uploaded_by) values($1,$2,$3,$4,$5,$6,$7,$8,$9)',[id,project,c,'pqrs','qa-case-evidence',path,'application/pdf',100,owner]);
  }
  await assert.rejects(()=>attach(1,{stored:false}),/row-level security/);
  await assert.rejects(()=>attach(1,{owner:b}),/row-level security/);
  await assert.rejects(()=>attach(1,{project:'b'}),/row-level security/);
  for(let n=1;n<=5;n++)await attach(n);
  await assert.rejects(()=>attach(6),/cinco evidencias/);
  assert.equal((await db.query('select * from qa_case_evidence')).rows.length,5);
  await db.exec(`set request.jwt.claim.sub='${b}';`);
  assert.equal((await db.query('select * from qa_case_evidence')).rows.length,0);
  assert.equal((await db.query('select * from storage.objects')).rows.length,0);
 }finally{await db.close();}
});
