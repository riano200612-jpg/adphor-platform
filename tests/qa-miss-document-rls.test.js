import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const a='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const b='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const hash='a'.repeat(64);
const driveId='1RTkvbz6YZftW4Ua_3XHs4PVEPX1kyotG';

test('Miss ADPHOR document quarantine: isolated SQL enforces AAL2, ownership, no read/download and noninterference',async()=>{
 const {PGlite}=await import('@electric-sql/pglite');
 const db=new PGlite();
 try {
  await db.exec(`
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE SCHEMA auth;
CREATE SCHEMA storage;
CREATE SCHEMA qa_identity_private;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
 AS $x$ SELECT nullif(current_setting('test.actor',true),'')::uuid $x$;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE
 AS $x$ SELECT jsonb_build_object('aal',current_setting('test.aal',true)) $x$;
CREATE FUNCTION qa_identity_private.current_principal() RETURNS text
 LANGUAGE sql STABLE AS $x$
 SELECT CASE WHEN auth.uid() IS NOT NULL
 AND current_setting('test.principal',true)='yes'
 AND (auth.jwt()->>'aal')='aal2' THEN 'qa_identity' ELSE NULL END $x$;
CREATE TABLE public.projects(id text PRIMARY KEY);
CREATE TABLE public.memberships(project_id text NOT NULL,user_id uuid NOT NULL,role text NOT NULL);
CREATE TABLE public.qa_meeting_events(id text);
CREATE TABLE storage.buckets(id text PRIMARY KEY,name text NOT NULL,public boolean NOT NULL,
 file_size_limit bigint,allowed_mime_types text[]);
CREATE TABLE storage.objects(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,bucket_id text NOT NULL,name text NOT NULL);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
CREATE POLICY legacy_select ON storage.objects FOR SELECT TO authenticated USING(true);
CREATE POLICY legacy_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK(true);
CREATE POLICY legacy_update ON storage.objects FOR UPDATE TO authenticated USING(true) WITH CHECK(true);
CREATE POLICY legacy_delete ON storage.objects FOR DELETE TO authenticated USING(true);
GRANT USAGE ON SCHEMA auth,storage,qa_identity_private TO authenticated;
GRANT SELECT ON public.memberships TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON storage.objects TO authenticated;
`);
  await db.query('insert into auth.users values ($1),($2)',[a,b]);
  await db.exec("insert into public.projects values ('source-1'),('source-2')");
  await db.query("insert into public.memberships values ('source-1',$1,'viewer'),('source-2',$2,'admin')",[a,b]);
  await db.exec("insert into storage.buckets values('other-evidence','other-evidence',false,1024,array['application/pdf'])");
  await db.exec("insert into storage.objects(bucket_id,name) values('other-evidence','source-1/old.pdf')");
  const sql=readFileSync(new URL('../supabase/migrations/20261120221708_qa_miss_document_intake_quarantine.sql',import.meta.url),'utf8');
  await db.exec(sql);
  const bucket=(await db.query("select public,file_size_limit from storage.buckets where id='qa-miss-documents'")).rows[0];
  assert.deepEqual(bucket,{public:false,file_size_limit:15728640});
  const fences=await db.query("select policyname,permissive,roles from pg_policies where schemaname='storage' and tablename='objects' and policyname like 'qa_miss_objects_%_fence'");
  assert.equal(fences.rows.length,4);
  assert.ok(fences.rows.every(p=>p.permissive==='RESTRICTIVE'&&p.roles.includes('public')));
  const role=async(actor,aal='aal2',principal='yes')=>{
   await db.query("select set_config('test.actor',$1,false),set_config('test.aal',$2,false),set_config('test.principal',$3,false)",[actor,aal,principal]);
  };
  const submit=()=>db.query(`INSERT INTO public.qa_miss_document_submissions
   (project_id,uploaded_by,source_kind,display_name,drive_file_id,drive_kind)
   VALUES('source-1',$1,'drive_link','Acta documental', $2,'file') RETURNING review_state`,[a,driveId]);
  await role(a,'aal1');await db.exec('SET ROLE authenticated');
  await assert.rejects(submit(),/row-level security/);
  await db.exec('RESET ROLE');
  await role(a,'aal2','no');await db.exec('SET ROLE authenticated');
  await assert.rejects(submit(),/row-level security/);
  await db.exec('RESET ROLE');
  await role(a);await db.exec('SET ROLE authenticated');
  assert.equal((await submit()).rows[0].review_state,'quarantined');
  await assert.rejects(db.query(`INSERT INTO public.qa_miss_document_submissions
   (project_id,uploaded_by,source_kind,display_name,drive_file_id,drive_kind)
   VALUES('source-2',$1,'drive_link','Otro edificio',$2,'file')`,[a,driveId]),/row-level security/);
  await assert.rejects(db.query(`INSERT INTO public.qa_miss_document_submissions
   (project_id,uploaded_by,source_kind,display_name,drive_file_id,drive_kind,review_state)
   VALUES('source-1',$1,'drive_link','Acta de consejo',$2,'file','approved')`,[a,driveId]),/row-level security|check constraint/);
  const path='source-1/'+a+'/'+hash+'.pdf';
  await db.query('INSERT INTO storage.objects(bucket_id,name) VALUES($1,$2)',['qa-miss-documents',path]);
  await assert.rejects(db.query('INSERT INTO storage.objects(bucket_id,name) VALUES($1,$2)',
   ['qa-miss-documents','source-2/'+a+'/'+hash+'.pdf']),/row-level security/);
  await assert.rejects(db.query('INSERT INTO storage.objects(bucket_id,name) VALUES($1,$2)',
   ['qa-miss-documents','source-1/'+b+'/'+hash+'.pdf']),/row-level security/);
  const visible=(await db.query('SELECT bucket_id FROM storage.objects ORDER BY bucket_id')).rows;
  assert.deepEqual(visible,[{bucket_id:'other-evidence'}]); // no read access to unscanned documents
  assert.equal((await db.query('SELECT count(*)::int AS n FROM public.qa_miss_document_submissions')).rows[0].n,1);
  await db.exec('RESET ROLE');
  await role(b);await db.exec('SET ROLE authenticated');
  assert.equal((await db.query('SELECT count(*)::int AS n FROM public.qa_miss_document_submissions')).rows[0].n,0);
  await assert.rejects(db.query('INSERT INTO storage.objects(bucket_id,name) VALUES($1,$2)',
   ['qa-miss-documents',path]),/row-level security/);
  await db.exec('RESET ROLE');
 }finally{await db.close();}
});
