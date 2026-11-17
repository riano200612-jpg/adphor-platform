import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

test('corporate photo import allows only active AAL2 corporate admins, enforces immutable portraits and logs',async()=>{
  const db=new PGlite();
  try{
    await db.exec([
      'create role anon;create role authenticated;',
      'create schema auth;create schema qa_identity_private;create schema storage;',
      'create table auth.users(id uuid primary key);',
      "create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;",
      "create function qa_identity_private.current_principal() returns text language sql stable security definer set search_path='' as $$select case when current_setting('test.aal',true)='aal2' then nullif(current_setting('test.principal',true),'') else null end$$;",
      'create table public.projects(id text primary key);',
      'create table public.memberships(project_id text,user_id uuid,role text);',
      "create function public.project_role(project text) returns text language sql stable security definer set search_path='' as $$select role from public.memberships where project_id=project and user_id=auth.uid() and current_setting('test.aal',true)='aal2'$$;",
      'create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);',
      'create table storage.objects(bucket_id text,name text,metadata jsonb);',
      'alter table storage.objects enable row level security;',
      'grant usage on schema auth,storage to authenticated;',
      'grant insert,select on storage.objects to authenticated;',
    ].join('\n'));
    const read=path=>readFile(new URL('../supabase/migrations/'+path,import.meta.url),'utf8');
    await db.exec(await read('20261106210345_qa_staff_directory.sql'));
    await db.exec(await read('20261114174718_qa_corporate_carousel_visibility.sql'));
    const migrations=await readdir(new URL('../supabase/migrations/',import.meta.url));
    const photoMigration=migrations.find(x=>/_qa_corporate_staff_photo_upload\.sql$/.test(x));
    assert.ok(photoMigration,'missing photo upload migration');
    await db.exec(await read(photoMigration));
    await db.exec([
      "insert into auth.users values('00000000-0000-4000-8000-000000000001');",
      "insert into qa_staff_members(id,name,role_code,role_label,active) values('delegate-16','Ruby Luz Ramos','D','Delegado',true),('delegate-54','aa','T','Auxiliar de Tecnología',true);",
      "set role authenticated;",
      "set request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';",
      "set test.aal='aal2';set test.principal='technical_admin';",
    ].join('\n'));
    const hash='a'.repeat(64);
    const path='delegate-16/'+hash+'.jpg';
    await db.query("insert into storage.objects(bucket_id,name,metadata) values($1,$2,$3)",[
      'qa-staff-photos',path,JSON.stringify({size:300,mimetype:'image/jpeg'}),
    ]);
    const attached=(await db.query("select qa_carousel_attach_photo('delegate-16',$1,'jpg') as path",[hash])).rows[0].path;
    assert.equal(attached,path);
    const rows=(await db.query("select photo_path from qa_carousel_directory() where id='delegate-16'")).rows;
    assert.equal(rows[0].photo_path,path);
    await assert.rejects(db.query("select qa_carousel_attach_photo('delegate-16',$1,'jpg')",[hash]),/ya tiene fotografía/);
    await assert.rejects(db.query("select * from qa_staff_photo_import_audit"),/permission denied/i);
    await assert.rejects(db.query("insert into storage.objects(bucket_id,name,metadata) values('qa-staff-photos',$1,'{}')",[
      'delegate-54/'+hash+'.jpg',
    ]),/row-level security policy/i);
    await db.exec("set test.principal='viewer'");
    await assert.rejects(db.query("select qa_carousel_attach_photo('delegate-54',$1,'jpg')",[hash]),/Sin autorización/);
    await db.exec("set test.principal='technical_admin';set test.aal='aal1'");
    await assert.rejects(db.query("select qa_carousel_attach_photo('delegate-54',$1,'jpg')",[hash]),/Sin autorización/);
  }finally{await db.close();}
});
