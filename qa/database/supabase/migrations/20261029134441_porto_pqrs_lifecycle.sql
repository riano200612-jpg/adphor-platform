-- QA ONLY. Apply after recovered/sql/01_porto_pilot_schema_QA_ONLY.sql.
-- Reentrant extension; does not import any real source or approve any mapping.
BEGIN;
CREATE SCHEMA IF NOT EXISTS pilot_private;
REVOKE ALL ON SCHEMA pilot_private FROM PUBLIC,anon,authenticated;
CREATE TABLE IF NOT EXISTS pilot_private.pqrs_sources (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 batch_id uuid NOT NULL, source_row integer NOT NULL CHECK(source_row>=2),
 source_case_id text NOT NULL, source_registered_at text, source_delegate_id text,
 requester_name text, reason text, detail text, attachment_link text, terms_accepted text,
 source_status text, ai_analysis text, ai_priority text, manual_priority text,
 solution text, source_closed_at text,
 raw_payload jsonb NOT NULL CHECK(jsonb_typeof(raw_payload)='object'),
 imported_at timestamptz NOT NULL DEFAULT now(), UNIQUE(batch_id,source_row)
);
CREATE TABLE IF NOT EXISTS pilot_private.pqrs_approved_mappings (
 source_id uuid PRIMARY KEY REFERENCES pilot_private.pqrs_sources,
 project_id text NOT NULL REFERENCES public.projects,
 approved_by uuid NOT NULL REFERENCES auth.users,
 approved_at timestamptz NOT NULL,
 reason text NOT NULL CHECK(length(btrim(reason))>=10),
 UNIQUE(source_id,project_id)
);
ALTER TABLE pilot_private.pqrs_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE pilot_private.pqrs_approved_mappings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA pilot_private FROM PUBLIC,anon,authenticated;
ALTER TABLE public.pilot_pqrs ADD COLUMN IF NOT EXISTS source_id uuid;
ALTER TABLE public.pilot_pqrs ADD COLUMN IF NOT EXISTS registered_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.pilot_pqrs ADD COLUMN IF NOT EXISTS due_at timestamptz;
ALTER TABLE public.pilot_pqrs ADD COLUMN IF NOT EXISTS solution text NOT NULL DEFAULT '';
ALTER TABLE public.pilot_pqrs ADD COLUMN IF NOT EXISTS closed_at timestamptz;
ALTER TABLE public.pilot_pqrs ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;
ALTER TABLE public.pilot_pqrs ADD COLUMN IF NOT EXISTS request_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS pilot_pqrs_source_once ON public.pilot_pqrs(source_id) WHERE source_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS pilot_pqrs_request_once ON public.pilot_pqrs(project_id,created_by,request_id) WHERE request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS pilot_pqrs_due ON public.pilot_pqrs(project_id,due_at) WHERE status<>'closed';
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.pilot_pqrs'::regclass AND conname='pqrs_approved_source_fk') THEN
  ALTER TABLE public.pilot_pqrs ADD CONSTRAINT pqrs_approved_source_fk FOREIGN KEY(source_id,project_id)
   REFERENCES pilot_private.pqrs_approved_mappings(source_id,project_id);
 END IF;
END $$;
CREATE TABLE IF NOT EXISTS public.pilot_pqrs_history (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), case_id uuid NOT NULL REFERENCES public.pilot_pqrs,
 actor_id uuid NOT NULL REFERENCES auth.users, occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 old_status text, new_status text NOT NULL, version integer NOT NULL, UNIQUE(case_id,version)
);
CREATE TABLE IF NOT EXISTS public.pilot_pqrs_responses (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), case_id uuid NOT NULL REFERENCES public.pilot_pqrs,
 actor_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users,
 body text NOT NULL CHECK(length(btrim(body)) BETWEEN 3 AND 12000),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE OR REPLACE FUNCTION public.pilot_validate_pqrs() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE role_name text := public.project_role(NEW.project_id);
BEGIN
 IF auth.uid() IS NULL OR role_name IS NULL OR role_name NOT IN ('admin','coordinator','technician') THEN
  RAISE EXCEPTION 'PQRS access denied' USING ERRCODE='42501';
 END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.created_by<>auth.uid() OR NEW.status<>'open' OR NEW.closed_at IS NOT NULL OR NEW.version<>1 THEN
   RAISE EXCEPTION 'Invalid initial state' USING ERRCODE='23514';
  END IF;
 ELSE
  IF (NEW.id,NEW.project_id,NEW.created_by,NEW.source_id,NEW.registered_at,NEW.request_id,NEW.created_at)
   IS DISTINCT FROM (OLD.id,OLD.project_id,OLD.created_by,OLD.source_id,OLD.registered_at,OLD.request_id,OLD.created_at) THEN
   RAISE EXCEPTION 'Immutable identity/provenance';
  END IF;
  IF NEW.version<>OLD.version THEN RAISE EXCEPTION 'Version is server-owned'; END IF;
  IF OLD.status='closed' THEN RAISE EXCEPTION 'Closed case is immutable'; END IF;
  IF NEW.status<>OLD.status AND NOT (
    (OLD.status='open' AND NEW.status IN ('assigned','in_progress')) OR
    (OLD.status='assigned' AND NEW.status='in_progress') OR
    (OLD.status='in_progress' AND NEW.status='resolved') OR
    (OLD.status='resolved' AND NEW.status IN ('in_progress','closed'))
  ) THEN RAISE EXCEPTION 'Invalid status transition'; END IF;
  NEW.version:=OLD.version+1;
 END IF;
 IF (TG_OP='INSERT' AND NEW.assignee IS NOT NULL) OR
    (TG_OP='UPDATE' AND NEW.assignee IS DISTINCT FROM OLD.assignee) THEN
  IF role_name NOT IN ('admin','coordinator') THEN RAISE EXCEPTION 'Assignment denied'; END IF;
 END IF;
 IF NEW.status IN ('assigned','in_progress','resolved','closed') AND NEW.assignee IS NULL THEN
  RAISE EXCEPTION 'Assignee required';
 END IF;
 IF NEW.status IN ('resolved','closed') AND length(btrim(NEW.solution))<3 THEN RAISE EXCEPTION 'Solution required'; END IF;
 IF NEW.status='closed' THEN
  IF role_name<>'admin' THEN RAISE EXCEPTION 'Administrator approval required' USING ERRCODE='42501'; END IF;
  NEW.closed_at:=clock_timestamp();
 ELSE NEW.closed_at:=NULL; END IF;
 IF NEW.due_at<NEW.registered_at THEN RAISE EXCEPTION 'Deadline precedes registration'; END IF;
 NEW.updated_at:=clock_timestamp(); RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS pilot_pqrs_validate ON public.pilot_pqrs;
CREATE TRIGGER pilot_pqrs_validate BEFORE INSERT OR UPDATE ON public.pilot_pqrs
 FOR EACH ROW EXECUTE FUNCTION public.pilot_validate_pqrs();
-- Narrow internal definer trigger: append history only. No public callable RPC.
CREATE OR REPLACE FUNCTION pilot_private.pqrs_audit() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 INSERT INTO public.pilot_pqrs_history(case_id,actor_id,old_status,new_status,version)
 VALUES(NEW.id,auth.uid(),CASE WHEN TG_OP='UPDATE' THEN OLD.status ELSE NULL END,NEW.status,NEW.version);
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION pilot_private.pqrs_audit() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS pilot_pqrs_audit ON public.pilot_pqrs;
CREATE TRIGGER pilot_pqrs_audit AFTER INSERT OR UPDATE ON public.pilot_pqrs
 FOR EACH ROW EXECUTE FUNCTION pilot_private.pqrs_audit();
ALTER TABLE public.pilot_pqrs_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pilot_pqrs_responses ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pilot_pqrs_history,public.pilot_pqrs_responses FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.pilot_pqrs_history,public.pilot_pqrs_responses TO authenticated;
GRANT INSERT(body,case_id) ON public.pilot_pqrs_responses TO authenticated;
GRANT INSERT(project_id,kind,subject,description,created_by,request_id) ON public.pilot_pqrs TO authenticated;
GRANT UPDATE(status,priority,assignee,due_at,solution) ON public.pilot_pqrs TO authenticated;
DROP POLICY IF EXISTS pqrs_create ON public.pilot_pqrs;
CREATE POLICY pqrs_create ON public.pilot_pqrs FOR INSERT TO authenticated
 WITH CHECK(created_by=auth.uid() AND public.project_role(project_id) IN ('admin','coordinator','technician') AND source_id IS NULL);
DROP POLICY IF EXISTS pqrs_change ON public.pilot_pqrs;
CREATE POLICY pqrs_change ON public.pilot_pqrs FOR UPDATE TO authenticated
 USING(public.project_role(project_id) IN ('admin','coordinator') OR (public.project_role(project_id)='technician' AND assignee=auth.uid()))
 WITH CHECK(public.project_role(project_id) IN ('admin','coordinator') OR (public.project_role(project_id)='technician' AND assignee=auth.uid()));
DROP POLICY IF EXISTS pqrs_history_read ON public.pilot_pqrs_history;
CREATE POLICY pqrs_history_read ON public.pilot_pqrs_history FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM public.pilot_pqrs p WHERE p.id=case_id));
DROP POLICY IF EXISTS pqrs_responses_read ON public.pilot_pqrs_responses;
CREATE POLICY pqrs_responses_read ON public.pilot_pqrs_responses FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM public.pilot_pqrs p WHERE p.id=case_id));
DROP POLICY IF EXISTS pqrs_responses_create ON public.pilot_pqrs_responses;
CREATE POLICY pqrs_responses_create ON public.pilot_pqrs_responses FOR INSERT TO authenticated
 WITH CHECK(actor_id=auth.uid() AND EXISTS(SELECT 1 FROM public.pilot_pqrs p WHERE p.id=case_id AND p.status<>'closed'));
REVOKE ALL ON FUNCTION public.pilot_validate_pqrs() FROM PUBLIC,anon,authenticated;
COMMIT;
