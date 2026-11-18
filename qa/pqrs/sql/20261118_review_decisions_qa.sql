-- QA ONLY: reproducible snapshot of adphor_pqrs_qa_recipient_review_decisions_20261118.
-- Never apply against production or José's Google Drive / Apps Script originals.
CREATE TABLE IF NOT EXISTS adphor_pqrs_qa.recipient_review_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 request_id uuid NOT NULL REFERENCES public.qa_pqrs_recipient_review_requests(id) ON DELETE RESTRICT,
 project_id text NOT NULL REFERENCES public.projects(id),
 old_status text,
 new_status text NOT NULL CHECK (new_status IN ('PENDING','CANCELLED','REJECTED')),
 actor_id uuid,
 changed_at timestamptz NOT NULL DEFAULT now(),
 source_reconciled_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS qa_pqrs_review_audit_request_idx
 ON adphor_pqrs_qa.recipient_review_audit(request_id,changed_at);
ALTER TABLE adphor_pqrs_qa.recipient_review_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE adphor_pqrs_qa.recipient_review_audit FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON adphor_pqrs_qa.recipient_review_audit TO service_role;
GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA adphor_pqrs_qa TO service_role;
CREATE OR REPLACE FUNCTION public.qa_pqrs_review_decision_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_actor uuid;
BEGIN
 IF TG_OP<>'UPDATE' THEN RAISE EXCEPTION 'Unexpected review operation' USING ERRCODE='42501'; END IF;
 v_actor:=auth.uid();
 IF v_actor IS NULL OR qa_identity_private.current_principal() IS DISTINCT FROM 'technical_admin'
    OR public.project_role(OLD.project_id) IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Current session is not authorized to review recipients' USING ERRCODE='42501';
 END IF;
 IF NEW.id IS DISTINCT FROM OLD.id OR NEW.project_id IS DISTINCT FROM OLD.project_id OR
    NEW.requested_by IS DISTINCT FROM OLD.requested_by OR
    NEW.requested_at IS DISTINCT FROM OLD.requested_at OR
    NEW.source_reconciled_at IS DISTINCT FROM OLD.source_reconciled_at THEN
    RAISE EXCEPTION 'Review request identifying fields are immutable' USING ERRCODE='42501';
 END IF;
 IF OLD.status<>'PENDING' OR NEW.status NOT IN ('CANCELLED','REJECTED') THEN
    RAISE EXCEPTION 'Review decision not allowed; approval requires independent email ownership evidence' USING ERRCODE='42501';
 END IF;
 IF NEW.status='CANCELLED' AND OLD.requested_by<>v_actor THEN
    RAISE EXCEPTION 'Only the requester can cancel a review' USING ERRCODE='42501';
 END IF;
 IF NEW.status='REJECTED' AND OLD.requested_by=v_actor THEN
    RAISE EXCEPTION 'Requester cannot review their own request' USING ERRCODE='42501';
 END IF;
 NEW.reviewed_by:=v_actor;
 NEW.reviewed_at:=now();
 RETURN NEW;
END $function$;
REVOKE ALL ON FUNCTION public.qa_pqrs_review_decision_guard() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS qa_pqrs_recipient_review_decision_guard ON public.qa_pqrs_recipient_review_requests;
CREATE TRIGGER qa_pqrs_recipient_review_decision_guard BEFORE UPDATE
 ON public.qa_pqrs_recipient_review_requests FOR EACH ROW
 EXECUTE FUNCTION public.qa_pqrs_review_decision_guard();
CREATE OR REPLACE FUNCTION adphor_pqrs_qa.audit_recipient_review()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
 IF TG_OP='INSERT' OR OLD.status IS DISTINCT FROM NEW.status THEN
  INSERT INTO adphor_pqrs_qa.recipient_review_audit(
   request_id,project_id,old_status,new_status,actor_id,source_reconciled_at)
  VALUES (NEW.id,NEW.project_id,CASE WHEN TG_OP='INSERT' THEN NULL ELSE OLD.status END,
   NEW.status,CASE WHEN TG_OP='INSERT' THEN NEW.requested_by ELSE NEW.reviewed_by END,NEW.source_reconciled_at);
 END IF;
 RETURN NEW;
END $function$;
REVOKE ALL ON FUNCTION adphor_pqrs_qa.audit_recipient_review() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS qa_pqrs_recipient_review_audit ON public.qa_pqrs_recipient_review_requests;
CREATE TRIGGER qa_pqrs_recipient_review_audit AFTER INSERT OR UPDATE
 ON public.qa_pqrs_recipient_review_requests FOR EACH ROW
 EXECUTE FUNCTION adphor_pqrs_qa.audit_recipient_review();
DROP POLICY IF EXISTS qa_pqrs_route_review_update ON public.qa_pqrs_recipient_review_requests;
CREATE POLICY qa_pqrs_route_review_update ON public.qa_pqrs_recipient_review_requests
 FOR UPDATE TO authenticated
 USING(qa_identity_private.current_principal()='technical_admin' AND public.project_role(project_id)='admin')
 WITH CHECK(qa_identity_private.current_principal()='technical_admin' AND public.project_role(project_id)='admin');
GRANT UPDATE(status) ON public.qa_pqrs_recipient_review_requests TO authenticated;
