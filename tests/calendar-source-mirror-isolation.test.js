import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

const schema=readFileSync(new URL('../supabase/migrations/20261119140000_qa_calendar_readonly_source_mirror.sql',import.meta.url),'utf8');
const setup=async()=>{
 const db=new PGlite();
 await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE TABLE public.projects(id text PRIMARY KEY);');
 await db.exec(schema);
 return db;
};

test('Calendar staging is a private, RLS-protected QA archive with no client grants or policies',async()=>{
 const db=await setup();
 try{
  const {rows}=await db.query("SELECT c.relrowsecurity AS rls, c.relkind AS kind, (SELECT count(*)::int FROM pg_policies WHERE schemaname='qa_calendar_private') AS policies, has_schema_privilege('anon','qa_calendar_private','USAGE') AS anon_usage, has_schema_privilege('authenticated','qa_calendar_private','USAGE') AS authenticated_usage, has_table_privilege('authenticated','qa_calendar_private.source_events','SELECT') AS authenticated_select, has_table_privilege('service_role','qa_calendar_private.source_events','SELECT') AS service_select FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='qa_calendar_private' AND c.relname='source_events'");
  assert.deepEqual(rows,[{rls:true,kind:'r',policies:0,anon_usage:false,authenticated_usage:false,authenticated_select:false,service_select:false}]);
 }finally{await db.close();}
});
test('Private source staging is idempotent and cannot mark unmapped Google events reviewed',async()=>{
 const db=await setup();
 try{
  const stmt="INSERT INTO qa_calendar_private.source_events(calendar_id,google_event_id,summary,start_at,end_at,source_status,source_window,import_batch) VALUES ('source','event-1','Consejo de QA','2026-11-21T12:00:00Z','2026-11-21T13:00:00Z','confirmed','2026','batch-1') ON CONFLICT(calendar_id,google_event_id) DO UPDATE SET summary=EXCLUDED.summary,last_seen_at=now()";
  await db.exec(stmt);
  await db.exec(stmt);
  const result=await db.query("SELECT count(*)::int AS count, bool_and(mapped_project_id IS NULL AND NOT mapping_reviewed) AS unmapped FROM qa_calendar_private.source_events");
  assert.deepEqual(result.rows,[{count:1,unmapped:true}]);
  await assert.rejects(db.exec("UPDATE qa_calendar_private.source_events SET mapping_reviewed=true WHERE google_event_id='event-1'"),/calendar_source_unmapped_not_verified/);
 }finally{await db.close();}
});
test('Google source mirror disallows inverted intervals and non-corporate enum statuses',async()=>{
 const db=await setup();
 try{
  for(const [status,start,end] of [['confirmed','2026-11-21T13:00:00Z','2026-11-21T12:00:00Z'],['unknown','2026-11-21T12:00:00Z','2026-11-21T13:00:00Z']]){
   const st="INSERT INTO qa_calendar_private.source_events(calendar_id,google_event_id,summary,start_at,end_at,source_status,source_window,import_batch) VALUES ('src','evt','QA','"+start+"','"+end+"','"+status+"','2026','test')";
   await assert.rejects(db.exec(st));
  }
 }finally{await db.close();}
});
