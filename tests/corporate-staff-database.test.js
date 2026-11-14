import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

test('corporate staff RPC enforces AAL2, role, audit and cross-property photo scope',async()=>{
  const db=new PGlite();
  const run=(...sql)=>db.exec(sql.join('\n'));
  try{
    await run(
      'create role anon;create role authenticated;',
      'create schema auth;create schema qa_identity_private;create schema storage;',
      'create table auth.users(id uuid primary key);',
      "create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;",
      "create function qa_identity_private.current_principal() returns text language sql stable security definer set search_path='' as $$select case when current_setting('test.aal',true)='aal2' then nullif(current_setting('test.principal',true),'') else null end$$;",
      'create table public.projects(id text primary key);',
      'create table public.memberships(project_id text,user_id uuid,role text);',
      "create function public.project_role(project text) returns text language sql stable security definer set search_path='' as $$select role from public.memberships where project_id=project and user_id=auth.uid() and current_setting('test.aal',true)='aal2'$$;",
      'create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);',
      'create table storage.objects(bucket_id text,name text);alter table storage.objects enable row level security;',
      'grant usage on schema auth,storage to authenticated;grant select on storage.objects to authenticated;'
    );
    await db.exec(await readFile(new URL('../supabase/migrations/20261106210345_qa_staff_directory.sql',import.meta.url),'utf8'));
    await db.exec(await readFile(new URL('../supabase/migrations/20261114174718_qa_corporate_carousel_visibility.sql',import.meta.url),'utf8'));
    await run(
      "insert into auth.users(id) values('00000000-0000-4000-8000-000000000001');",
      "insert into projects(id) values('a');",
      "insert into memberships values('a','00000000-0000-4000-8000-000000000001','admin');",
      "insert into qa_staff_members(id,name,role_code,role_label,active,photo_path,photo_sha256,source_sha256) values ('delegate-1','Asignado','D','Delegado',true,'delegate-1/'||repeat('a',64)||'.jpg',repeat('a',64),repeat('b',64)),('delegate-2','No asignado','GT','Gerente de Tecnología',true,'delegate-2/'||repeat('c',64)||'.jpg',repeat('c',64),repeat('b',64));",
      "insert into qa_staff_assignments values('a','delegate-1','delegate');",
      "insert into storage.objects values('qa-staff-photos','delegate-1/'||repeat('a',64)||'.jpg'),('qa-staff-photos','delegate-2/'||repeat('c',64)||'.jpg'),('qa-staff-photos','unauthorized.jpg');",
      "set role authenticated;set request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';",
      "set test.aal='aal2';set test.principal='technical_admin';"
    );
    let rows=(await db.query('select id,department,assigned_properties from qa_carousel_directory()')).rows;
    assert.equal(rows.length,2,'unassigned person remains in corporate directory');
    assert.ok(rows.some(r=>r.id==='delegate-2' && r.assigned_properties===0 && r.department==='Tecnología'));
    assert.equal((await db.query('select qa_carousel_can_manage() as allowed')).rows[0].allowed,true);
    assert.equal((await db.query('select * from storage.objects')).rows.length,2);
    await db.query("select qa_carousel_set_visibility('delegate-2',false)");
    await db.query("select qa_carousel_set_visibility('delegate-2',false)");
    assert.equal((await db.query('select * from qa_carousel_history()')).rows.length,1);
    assert.equal((await db.query('select carousel_visible from qa_carousel_directory() where id=\'delegate-2\'')).rows[0].carousel_visible,false);
    await assert.rejects(db.exec('update qa_staff_members set carousel_visible=true'),/permission denied/i);
    await db.exec("set test.principal='viewer'");
    assert.equal((await db.query('select qa_carousel_can_manage() as allowed')).rows[0].allowed,false);
    rows=(await db.query('select id from qa_carousel_directory()')).rows;
    assert.deepEqual(rows.map(r=>r.id),['delegate-1']);
    assert.equal((await db.query('select * from storage.objects')).rows.length,1);
    await assert.rejects(db.query("select qa_carousel_set_visibility('delegate-2',true)"),/No autorizado/);
    await assert.rejects(db.query('select * from qa_carousel_history()'),/No autorizado/);
    await db.exec("set test.principal='technical_admin';set test.aal='aal1'");
    assert.equal((await db.query('select qa_carousel_can_manage() as allowed')).rows[0].allowed,false);
    assert.equal((await db.query('select * from qa_carousel_directory()')).rows.length,0);
    await assert.rejects(db.query("select qa_carousel_set_visibility('delegate-1',false)"),/No autorizado/);
    await db.exec('reset role;set role anon');
    await assert.rejects(db.query('select * from qa_carousel_directory()'),/permission denied/i);
  }finally{await db.close();}
});
