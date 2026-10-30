-- Run in disposable PostgreSQL only, after applying QA migrations.
\set ON_ERROR_STOP on
DO $$
DECLARE a uuid; b uuid; n integer;
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='pilot_meetings') THEN RAISE EXCEPTION 'No meeting RLS policy'; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='pilot_pqrs') THEN RAISE EXCEPTION 'No PQRS RLS policy'; END IF;
 IF EXISTS (SELECT 1 FROM information_schema.role_table_grants
     WHERE table_name IN ('pilot_meetings','pilot_pqrs') AND grantee='anon') THEN
     RAISE EXCEPTION 'Anonymous access was granted';
 END IF;
 -- Each project must remain independent and have an explicit FK.
 SELECT COUNT(*) INTO n FROM pg_constraint WHERE conname='pilot_meeting_exception_same_project_fk';
 IF n<>1 THEN RAISE EXCEPTION 'Cross-project exception FK missing'; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='pilot_meeting_window' AND tgenabled<>'D') THEN
     RAISE EXCEPTION 'Meeting guard trigger missing';
 END IF;
 IF (SELECT public FROM storage.buckets WHERE id='porto-pilot-private') IS DISTINCT FROM false THEN
     RAISE EXCEPTION 'Private bucket not configured';
 END IF;
END $$;
DO $$
DECLARE created uuid; blocked boolean:=false;
BEGIN
 -- A valid booking >24h must create one reminder job.
 INSERT INTO public.pilot_meetings(project_id,title,starts_at,ends_at,created_by)
 VALUES ('qa-a','Consejo de QA',now()+interval '4 days',now()+interval '4 days 2 hours','00000000-0000-0000-0000-000000000001')
 RETURNING id INTO created;
 IF (SELECT COUNT(*) FROM public.pilot_meeting_confirmation_jobs WHERE meeting_id=created)<>1 THEN
   RAISE EXCEPTION 'Reminder job missing';
 END IF;
 -- A conflicting booking with the 30-minute buffer must be rejected.
 BEGIN
   INSERT INTO public.pilot_meetings(project_id,title,starts_at,ends_at,created_by)
   VALUES ('qa-a','Conflicto QA',now()+interval '4 days 2 hours 15 minutes',now()+interval '4 days 3 hours','00000000-0000-0000-0000-000000000001');
 EXCEPTION WHEN others THEN blocked:=true;
 END;
 IF NOT blocked THEN RAISE EXCEPTION 'Meeting overlap not blocked'; END IF;
 -- Under 24 hours, request without matching approved exception must be blocked.
 blocked:=false;
 BEGIN
   INSERT INTO public.pilot_meetings(project_id,title,starts_at,ends_at,created_by)
   VALUES ('qa-b','Reunión urgente QA',now()+interval '3 hours',now()+interval '4 hours','00000000-0000-0000-0000-000000000001');
 EXCEPTION WHEN others THEN blocked:=true;
 END;
 IF NOT blocked THEN RAISE EXCEPTION '24h protection not enforced'; END IF;
END $$;
