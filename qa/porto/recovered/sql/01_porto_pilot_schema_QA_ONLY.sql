-- ADPHOR / PORTO CASTELLO: CANDIDATE MIGRATION FOR AN ISOLATED SUPABASE QA PROJECT.
-- DO NOT RUN ON THE CURRENT ADPHOR DATABASE. REVIEW, BACKUP, MIGRATION TESTS FIRST.
-- Existing prerequisite in target: public.projects, public.memberships, public.project_role(text).
-- All times stored as timestamptz UTC; display and daily calendar in America/Bogota.
BEGIN;

CREATE TABLE public.pilot_meetings (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 project_id text NOT NULL REFERENCES public.projects(id),
 title text NOT NULL CHECK (length(btrim(title)) BETWEEN 3 AND 200),
 details text NOT NULL DEFAULT '' CHECK (length(details) <= 5000),
 starts_at timestamptz NOT NULL,
 ends_at timestamptz NOT NULL,
 status text NOT NULL DEFAULT 'scheduled' CHECK (status IN
    ('scheduled','confirmation_in_progress','confirmed','cancelled','completed')),
 created_by uuid NOT NULL REFERENCES auth.users(id),
 last_exception_id uuid,
 version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK (ends_at > starts_at)
);
CREATE INDEX pilot_meetings_project_starts ON public.pilot_meetings(project_id, starts_at);

CREATE TABLE public.pilot_late_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 project_id text NOT NULL REFERENCES public.projects(id),
 meeting_id uuid REFERENCES public.pilot_meetings(id),
 requested_by uuid NOT NULL REFERENCES auth.users(id),
 requested_at timestamptz NOT NULL DEFAULT now(),
 reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 10 AND 2000),
 proposed_title text NOT NULL CHECK (length(btrim(proposed_title)) BETWEEN 3 AND 200),
 proposed_starts_at timestamptz NOT NULL,
 proposed_ends_at timestamptz NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
 decided_by uuid REFERENCES auth.users(id),
 decided_at timestamptz,
 consumed_at timestamptz,
 CHECK (proposed_ends_at > proposed_starts_at),
 CHECK ((status='pending' AND decided_by IS NULL AND decided_at IS NULL)
     OR (status <> 'pending' AND decided_by IS NOT NULL AND decided_at IS NOT NULL)),
 CHECK (decided_by IS DISTINCT FROM requested_by)
);
-- Same-property FK protects the exception from cross-tenant meeting references.
ALTER TABLE public.pilot_meetings ADD CONSTRAINT pilot_meetings_id_project_uq UNIQUE (id,project_id);
ALTER TABLE public.pilot_late_requests ADD CONSTRAINT pilot_late_meeting_same_project_fk
 FOREIGN KEY (meeting_id,project_id) REFERENCES public.pilot_meetings(id,project_id);
ALTER TABLE public.pilot_late_requests ADD CONSTRAINT pilot_late_request_id_project_uq UNIQUE (id,project_id);
ALTER TABLE public.pilot_meetings ADD CONSTRAINT pilot_meeting_exception_same_project_fk
 FOREIGN KEY (last_exception_id,project_id) REFERENCES public.pilot_late_requests(id,project_id);
CREATE INDEX pilot_late_requests_pending ON public.pilot_late_requests(project_id, requested_at)
 WHERE status='pending';

-- DB HARD BLOCK: applies also if UI checks are bypassed.
-- Only the trusted server may mutate meeting tables. An exception must be approved,
-- unconsumed, for exactly the proposed meeting/project/title/start/end.
CREATE FUNCTION public.pilot_enforce_meeting_window() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE need_exception boolean := false; approved boolean := false;
BEGIN
  IF TG_OP = 'INSERT' THEN
    need_exception := NEW.starts_at < clock_timestamp() + interval '24 hours';
  ELSE
    need_exception := OLD.starts_at < clock_timestamp() + interval '24 hours'
      OR NEW.starts_at < clock_timestamp() + interval '24 hours';
    NEW.version := OLD.version + 1;
    NEW.updated_at := clock_timestamp();
  END IF;
  IF NEW.starts_at <= clock_timestamp() AND NEW.status <> 'cancelled' THEN
    RAISE EXCEPTION 'meeting must be in the future' USING ERRCODE='23514';
  END IF;
  IF need_exception THEN
    SELECT (r.status='approved' AND r.consumed_at IS NULL
      AND r.project_id=NEW.project_id AND r.meeting_id IS NOT DISTINCT FROM
        CASE WHEN TG_OP='INSERT' THEN NULL::uuid ELSE OLD.id END
      AND r.proposed_title=NEW.title AND r.proposed_starts_at=NEW.starts_at
      AND r.proposed_ends_at=NEW.ends_at)
    INTO approved FROM public.pilot_late_requests r WHERE r.id=NEW.last_exception_id;
    IF NOT COALESCE(approved,false) THEN
      RAISE EXCEPTION '24h booking/modification lock: approved late request required'
        USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER pilot_meeting_window BEFORE INSERT OR UPDATE ON public.pilot_meetings
 FOR EACH ROW EXECUTE FUNCTION public.pilot_enforce_meeting_window();

CREATE TABLE public.pilot_meeting_confirmation_jobs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 meeting_id uuid NOT NULL REFERENCES public.pilot_meetings(id),
 project_id text NOT NULL REFERENCES public.projects(id),
 remind_at timestamptz NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sending','sent','failed','cancelled')),
 attempts integer NOT NULL DEFAULT 0 CHECK (attempts>=0),
 sent_at timestamptz,
 last_error text NOT NULL DEFAULT '',
 UNIQUE (meeting_id, remind_at)
);
ALTER TABLE public.pilot_meeting_confirmation_jobs
 ADD CONSTRAINT pilot_confirmation_same_project_fk
 FOREIGN KEY (meeting_id,project_id) REFERENCES public.pilot_meetings(id,project_id);
CREATE INDEX pilot_confirm_due ON public.pilot_meeting_confirmation_jobs(remind_at)
 WHERE status IN ('pending','failed');

CREATE FUNCTION public.pilot_reschedule_confirmation() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 UPDATE public.pilot_meeting_confirmation_jobs SET status='cancelled'
 WHERE meeting_id=NEW.id AND status IN ('pending','failed')
   AND (remind_at IS DISTINCT FROM NEW.starts_at - interval '24 hours'
      OR NEW.status IN ('cancelled','completed'));
 IF NEW.status IN ('scheduled','confirmation_in_progress','confirmed') THEN
   INSERT INTO public.pilot_meeting_confirmation_jobs(meeting_id,project_id,remind_at)
   VALUES(NEW.id, NEW.project_id, NEW.starts_at - interval '24 hours')
   ON CONFLICT (meeting_id,remind_at) DO NOTHING;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER pilot_confirmation_outbox AFTER INSERT OR UPDATE OF starts_at,status
 ON public.pilot_meetings FOR EACH ROW EXECUTE FUNCTION public.pilot_reschedule_confirmation();

CREATE TABLE public.pilot_pqrs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 project_id text NOT NULL REFERENCES public.projects(id),
 kind text NOT NULL CHECK(kind IN ('peticion','queja','reclamo','sugerencia')),
 subject text NOT NULL CHECK(length(btrim(subject)) BETWEEN 3 AND 200),
 description text NOT NULL CHECK(length(btrim(description)) BETWEEN 3 AND 6000),
 status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','assigned','in_progress','resolved','closed')),
 priority text NOT NULL DEFAULT 'media' CHECK(priority IN ('baja','media','alta','urgente')),
 created_by uuid NOT NULL REFERENCES auth.users(id),
 assignee uuid,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY (project_id,assignee) REFERENCES public.memberships(project_id,user_id)
);
CREATE INDEX pilot_pqrs_project_status ON public.pilot_pqrs(project_id,status,created_at DESC);

CREATE TABLE public.pilot_daily_reports (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 project_id text NOT NULL REFERENCES public.projects(id),
 report_date date NOT NULL,
 revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
 request_id uuid NOT NULL UNIQUE, -- idempotency: retries never create duplicate reports
 summary text NOT NULL CHECK(length(btrim(summary)) BETWEEN 10 AND 12000),
 status text NOT NULL DEFAULT 'submitted' CHECK(status IN ('draft','submitted','approved','rejected')),
 created_by uuid NOT NULL REFERENCES auth.users(id),
 approved_by uuid REFERENCES auth.users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 approved_at timestamptz,
 UNIQUE(project_id,report_date,revision),
 CHECK ((status='approved' AND approved_by IS NOT NULL AND approved_at IS NOT NULL)
    OR status<>'approved')
);
CREATE INDEX pilot_reports_project_date ON public.pilot_daily_reports(project_id,report_date DESC);

CREATE TABLE public.pilot_attachments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 project_id text NOT NULL REFERENCES public.projects(id),
 report_id uuid NOT NULL REFERENCES public.pilot_daily_reports(id),
 object_path text NOT NULL UNIQUE CHECK(object_path !~ '(^/|\.\.)'),
 original_filename text NOT NULL CHECK(length(original_filename)<=240),
 content_type text NOT NULL CHECK(content_type IN
 ('application/pdf','image/jpeg','image/png','image/webp','video/mp4','video/webm')),
 size_bytes bigint NOT NULL CHECK(size_bytes>0 AND size_bytes<=52428800),
 sha256 text NOT NULL CHECK(sha256 ~ '^[0-9a-f]{64}$'),
 scan_status text NOT NULL DEFAULT 'pending' CHECK(scan_status IN ('pending','clean','rejected')),
 uploaded_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.pilot_daily_reports ADD CONSTRAINT pilot_reports_id_project_uq UNIQUE(id,project_id);
ALTER TABLE public.pilot_attachments ADD CONSTRAINT pilot_attachment_same_project_fk
 FOREIGN KEY(report_id,project_id) REFERENCES public.pilot_daily_reports(id,project_id);

CREATE TABLE public.pilot_document_manifest (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 project_id text NOT NULL REFERENCES public.projects(id),
 provider text NOT NULL DEFAULT 'google_drive' CHECK(provider IN ('google_drive','manual')),
 source_file_id text NOT NULL,
 source_modified_at timestamptz NOT NULL,
 source_name text NOT NULL,
 mime_type text NOT NULL,
 classification text NOT NULL CHECK(classification IN
  ('maintenance','meeting','technical','administrative','legal','other')),
 permission_status text NOT NULL DEFAULT 'pending' CHECK(permission_status IN ('pending','approved','rejected')),
 file_sha256 text,
 approved_by uuid REFERENCES auth.users(id),
 approved_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(project_id,provider,source_file_id,source_modified_at),
 CHECK(file_sha256 IS NULL OR file_sha256 ~ '^[0-9a-f]{64}$'),
 CHECK((permission_status='approved' AND approved_by IS NOT NULL AND approved_at IS NOT NULL)
   OR permission_status<>'approved')
);

CREATE TABLE public.pilot_agent_outbox (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 project_id text NOT NULL REFERENCES public.projects(id),
 kind text NOT NULL CHECK(kind IN ('daily_report_approved','document_approved')),
 source_id uuid NOT NULL,
 ready_for_agents boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(),
 processed_at timestamptz,
 UNIQUE(project_id,kind,source_id)
);
-- An approved report creates a gated event; approval does NOT grant agent read.
CREATE FUNCTION public.pilot_report_outbox() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF NEW.status='approved' AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM 'approved') THEN
   INSERT INTO public.pilot_agent_outbox(project_id,kind,source_id)
   VALUES(NEW.project_id,'daily_report_approved',NEW.id) ON CONFLICT DO NOTHING;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER pilot_report_event AFTER INSERT OR UPDATE OF status ON public.pilot_daily_reports
 FOR EACH ROW EXECUTE FUNCTION public.pilot_report_outbox();

CREATE TABLE public.pilot_daily_reminder_settings (
 project_id text PRIMARY KEY REFERENCES public.projects(id),
 timezone text NOT NULL DEFAULT 'America/Bogota' CHECK(timezone='America/Bogota'),
 remind_local_time time NOT NULL DEFAULT time '17:00',
 enabled boolean NOT NULL DEFAULT false,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.pilot_notification_outbox (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 project_id text NOT NULL REFERENCES public.projects(id),
 kind text NOT NULL CHECK(kind IN ('daily_report_reminder','late_request_to_manager')),
 source_key text NOT NULL,
 recipient_id uuid NOT NULL REFERENCES auth.users(id),
 due_at timestamptz NOT NULL,
 state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','sending','sent','failed')),
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts>=0),
 sent_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(project_id,kind,source_key,recipient_id)
);
CREATE INDEX pilot_notification_due ON public.pilot_notification_outbox(due_at)
 WHERE state IN ('pending','failed');

-- All tenant tables default deny. Browser only gets SELECT where role is authorized;
-- all changes run via a trusted backend that verifies JWT, role, tenant and limits.
DO $$ DECLARE table_name text; BEGIN
 FOREACH table_name IN ARRAY ARRAY[
  'pilot_meetings','pilot_late_requests','pilot_meeting_confirmation_jobs',
  'pilot_pqrs','pilot_daily_reports','pilot_attachments','pilot_document_manifest',
  'pilot_agent_outbox','pilot_daily_reminder_settings','pilot_notification_outbox'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',table_name);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated',table_name);
 END LOOP;
END $$;
GRANT SELECT ON public.pilot_meetings,public.pilot_pqrs,public.pilot_daily_reports TO authenticated;
CREATE POLICY pilot_meeting_member_read ON public.pilot_meetings FOR SELECT TO authenticated
 USING(public.project_role(project_id) IS NOT NULL);
CREATE POLICY pilot_pqrs_member_read ON public.pilot_pqrs FOR SELECT TO authenticated
 USING(public.project_role(project_id) IN ('admin','coordinator','technician'));
CREATE POLICY pilot_daily_reports_member_read ON public.pilot_daily_reports FOR SELECT TO authenticated
 USING(public.project_role(project_id) IN ('admin','coordinator'));

-- Pilot storage: PRIVATE + 50 MB cap consistent with Supabase Free global cap.
-- Huge meeting videos remain in Drive / approved external storage, referenced by metadata only.
-- Paid upgrade and migration to increase limits require separate authorization.
-- Use backend-issued short-lived upload URLs only after auth.
-- Do not add public object SELECT/INSERT/UPDATE policies here.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 VALUES('porto-pilot-private','porto-pilot-private',false,52428800,
 ARRAY['application/pdf','image/jpeg','image/png','image/webp','video/mp4','video/webm'])
 ON CONFLICT(id) DO NOTHING;

COMMIT;
