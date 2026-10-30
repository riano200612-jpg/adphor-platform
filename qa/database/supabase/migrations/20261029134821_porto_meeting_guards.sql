-- QA only; extends recovered schema. Does not authorize browser meeting writes.
BEGIN;
ALTER TABLE public.pilot_meeting_confirmation_jobs ADD COLUMN IF NOT EXISTS attempted_at timestamptz;
ALTER TABLE public.pilot_notification_outbox ADD COLUMN IF NOT EXISTS attempted_at timestamptz;
CREATE OR REPLACE FUNCTION public.pilot_enforce_meeting_window() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE need_exception boolean; r public.pilot_late_requests; t timestamptz := statement_timestamp();
BEGIN
 -- Serialize bookings of a project's shared resource. No client override.
 PERFORM 1 FROM public.projects WHERE id=NEW.project_id FOR UPDATE;
 IF TG_OP='UPDATE' THEN
  IF (NEW.id,NEW.project_id,NEW.created_by) IS DISTINCT FROM (OLD.id,OLD.project_id,OLD.created_by) THEN RAISE EXCEPTION 'Immutable meeting identity'; END IF;
  NEW.version:=OLD.version+1; NEW.updated_at:=t;
  -- Confirmation is not a rescheduling and must remain possible inside 24h.
  need_exception := (NEW.title,NEW.starts_at,NEW.ends_at,NEW.details) IS DISTINCT FROM (OLD.title,OLD.starts_at,OLD.ends_at,OLD.details)
   OR (NEW.status='cancelled' AND OLD.status<>'cancelled');
  need_exception := need_exception AND (OLD.starts_at<t+interval '24 hours' OR NEW.starts_at<t+interval '24 hours');
 ELSE need_exception:=NEW.starts_at<t+interval '24 hours'; END IF;
 IF NEW.starts_at<=t AND NEW.status NOT IN ('cancelled','completed') THEN RAISE EXCEPTION 'Meeting must be future'; END IF;
 IF need_exception THEN
  SELECT * INTO r FROM public.pilot_late_requests WHERE id=NEW.last_exception_id FOR UPDATE;
  IF r.id IS NULL OR r.status<>'approved' OR r.consumed_at IS NOT NULL OR r.project_id<>NEW.project_id
   OR r.meeting_id IS DISTINCT FROM (CASE WHEN TG_OP='INSERT' THEN NULL::uuid ELSE OLD.id END)
   OR (r.proposed_title,r.proposed_starts_at,r.proposed_ends_at) IS DISTINCT FROM (NEW.title,NEW.starts_at,NEW.ends_at)
   OR r.decided_by=r.requested_by THEN RAISE EXCEPTION 'Approved exact exception required'; END IF;
 END IF;
 IF NEW.status NOT IN ('cancelled','completed') AND EXISTS(
  SELECT 1 FROM public.pilot_meetings m WHERE m.project_id=NEW.project_id AND m.id<>NEW.id
   AND m.status NOT IN ('cancelled','completed')
   AND NEW.starts_at<m.ends_at+interval '30 minutes' AND NEW.ends_at+interval '30 minutes'>m.starts_at
 ) THEN RAISE EXCEPTION 'Calendar conflict including 30 minute buffer'; END IF;
 IF need_exception THEN UPDATE public.pilot_late_requests SET consumed_at=t WHERE id=r.id; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.pilot_enforce_meeting_window() FROM PUBLIC,anon,authenticated;
COMMIT;
