import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('isolated PostgreSQL denies AAL1 and other properties; enforces distinct reviewer, audit and idempotency',async()=>{
 const {PGlite}=await import('@electric-sql/pglite');
 const db=new PGlite();
 const a='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 const b='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
 const c='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
 const id='11111111-1111-4111-8111-111111111111';
 try{
  await db.exec([
   'CREATE ROLE anon;',
   'CREATE ROLE authenticated;',
   'CREATE SCHEMA auth;',
   'CREATE TABLE auth.users(id uuid PRIMARY KEY);',
   'CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $f$',
   " SELECT nullif(current_setting('test.actor',true),'')::uuid",
   '$f$;',
   'CREATE SCHEMA qa_identity_private;',
   'CREATE FUNCTION qa_identity_private.current_principal() RETURNS text LANGUAGE sql STABLE AS $f$',
   " SELECT CASE WHEN current_setting('test.aal',true)='aal2' THEN 'test' ELSE null END",
   '$f$;',
   'CREATE TABLE public.projects(id text PRIMARY KEY);',
   'CREATE TABLE public.memberships(project_id text NOT NULL,user_id uuid NOT NULL,role text NOT NULL);',
   'CREATE FUNCTION public.project_role(project text) RETURNS text LANGUAGE sql STABLE AS $f$',
   ' SELECT role FROM public.memberships WHERE project_id=project',
   ' AND user_id=auth.uid() AND qa_identity_private.current_principal() IS NOT NULL LIMIT 1',
   '$f$;',
   'CREATE TABLE public.qa_meeting_events(id text);'
  ].join('\n'));
  await db.query('insert into auth.users(id) values ($1),($2),($3)',[a,b,c]);
  await db.exec("insert into public.projects(id) values('p1'),('p2')");
  await db.query("insert into public.memberships values ('p1',$1,'admin'),('p1',$2,'coordinator'),('p2',$3,'admin')",[a,b,c]);
  await db.exec(readFileSync(new URL('../supabase/migrations/20261119210000_qa_task_catalog_candidate_review.sql',import.meta.url),'utf8'));
  const grants=await db.query([
   "select has_table_privilege('authenticated','public.qa_task_catalog_candidates','SELECT') as can_read,",
   "has_table_privilege('authenticated','public.qa_task_catalog_candidates','INSERT') as can_insert,",
   "has_table_privilege('authenticated','public.qa_task_catalog_events','UPDATE') as can_edit_events,",
   "has_table_privilege('anon','public.qa_task_catalog_candidates','SELECT') as anonymous"
  ].join(' '));
  assert.deepEqual(grants.rows[0],{can_read:true,can_insert:false,can_edit_events:false,anonymous:false});
  async function identity(actor,aal='aal2'){
   await db.query("select set_config('test.actor',$1,false),set_config('test.aal',$2,false)",[actor,aal]);
  }
  const submit=(cmd,payload)=>db.query(
    'select (public.qa_task_candidate_command($1,$2::jsonb)).status as status',
    [cmd,JSON.stringify(payload)]);
  const proposal={id,project_id:'p1',title:'Informe de gestión',description:'Solo propuesta',cadence:'monthly'};
  await identity(a,'aal1');
  await assert.rejects(submit('propose',proposal),/AAL2/);
  await identity(a);
  await assert.rejects(submit('propose',{...proposal,project_id:'p2'}),/No puedes proponer/);
  assert.equal((await submit('propose',proposal)).rows[0].status,'proposed');
  assert.equal((await submit('propose',proposal)).rows[0].status,'proposed');
  assert.equal((await db.query('select count(*)::int as n from public.qa_task_catalog_events')).rows[0].n,1);
  await assert.rejects(submit('review',{id,decision:'reviewed_for_design',note:'Revisar datos'}),/otra persona/);
  await identity(c);
  await assert.rejects(submit('review',{id,decision:'reviewed_for_design',note:'Revisar datos'}),/no está disponible/);
  await identity(b);
  const review={id,decision:'reviewed_for_design',note:'Pendiente de catálogo firmado'};
  assert.equal((await submit('review',review)).rows[0].status,'reviewed_for_design');
  assert.equal((await submit('review',review)).rows[0].status,'reviewed_for_design');
  assert.equal((await db.query('select count(*)::int as n from public.qa_task_catalog_events')).rows[0].n,2);
  await assert.rejects(submit('review',{...review,decision:'rejected'}),/ya recibió/);
 }finally{await db.close();}
});
