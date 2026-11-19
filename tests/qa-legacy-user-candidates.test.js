import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

const migration=readFileSync(new URL('../qa/database/supabase/migrations/20261119173000_qa_legacy_user_candidates.sql',import.meta.url),'utf8');
const OWNER='11111111-1111-4111-8111-111111111111';
const SESSION='22222222-2222-4222-8222-222222222222';
test('legacy staging is read-only to browsers and requires exact IAM admin+session',async()=>{
 const db=new PGlite();
 try{
  await db.exec([
   'create role anon; create role authenticated; create role service_role bypassrls;',
   'create schema auth; create schema qa_identity_private;',
   'create table auth.users(id uuid primary key);',
   'create table public.qa_staff_members(id text primary key);',
   "create function public.qa_iam_is_operator(p_user uuid,p_session uuid) returns boolean language sql stable as $$ select p_user='11111111-1111-4111-8111-111111111111'::uuid and p_session='22222222-2222-4222-8222-222222222222'::uuid $$;",
   "insert into public.qa_staff_members values('qa-one');",
   "insert into auth.users values('11111111-1111-4111-8111-111111111111');"
  ].join('\n'));
  await db.exec(migration);
  await db.exec(migration);
  await db.exec("insert into qa_identity_private.legacy_user_candidates (legacy_id,username,display_name,legacy_role_code,legacy_status,qa_staff_id,review_classification) values ('1','j.guzman','Persona QA','GT','Activo','qa-one','MATCHED'),('2','x.bloqueado','Persona bloqueada','D','Bloqueado',null,'BLOCKED');");
  const data=(await db.query("select public.qa_iam_legacy_review('"+OWNER+"','"+SESSION+"') as review")).rows[0].review;
  assert.equal(data.total,2);
  assert.equal(data.candidates.length,2);
  assert.deepEqual(data.candidates.find(c=>c.username==='j.guzman'),{
   username:'j.guzman',display_name:'Persona QA',legacy_status:'Activo',
   review_classification:'MATCHED',staff_matched:true,auth_linked:false
  });
  assert.equal(data.candidates.find(c=>c.username==='x.bloqueado').legacy_status,'Bloqueado');
  assert.equal((await db.query('select count(*)::int as n from auth.users')).rows[0].n,1);
  await assert.rejects(db.query("select public.qa_iam_legacy_review('"+OWNER+"','33333333-3333-4333-8333-333333333333')"),/IAM_NOT_AUTHORIZED/);
  const permissions=(await db.query("select has_table_privilege('authenticated','qa_identity_private.legacy_user_candidates','SELECT') as table_read,has_function_privilege('authenticated','public.qa_iam_legacy_review(uuid,uuid)','EXECUTE') as rpc_execute")).rows[0];
  assert.equal(permissions.table_read,false);
  assert.equal(permissions.rpc_execute,false);
 }finally{await db.close();}
});
