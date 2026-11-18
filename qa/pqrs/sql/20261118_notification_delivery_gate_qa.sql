-- SNAPSHOT, QA ONLY. Already installed in Supabase adphor-qa as adphor_pqrs_qa_outbox_delivery_gate_20261118.
-- DO NOT apply to production or to Jose's original Apps Script / Drive files.
-- This is idempotent for reproducibility. Never sets enabled=true.
CREATE TABLE IF NOT EXISTS adphor_pqrs_qa.notification_delivery_gate(
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 enabled boolean NOT NULL DEFAULT false,
 provider_code text NOT NULL DEFAULT 'UNCONFIGURED',
 enabled_at timestamptz,enabled_by uuid,
 CONSTRAINT qa_delivery_activation_requires_provider CHECK(
 NOT enabled OR (provider_code<>'UNCONFIGURED' AND length(trim(provider_code))>=3
 AND enabled_at IS NOT NULL AND enabled_by IS NOT NULL))
);
INSERT INTO adphor_pqrs_qa.notification_delivery_gate(singleton,enabled,provider_code)
 VALUES(true,false,'UNCONFIGURED') ON CONFLICT(singleton) DO NOTHING;
ALTER TABLE adphor_pqrs_qa.notification_delivery_gate ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON adphor_pqrs_qa.notification_delivery_gate FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON adphor_pqrs_qa.notification_delivery_gate TO service_role;
CREATE TABLE IF NOT EXISTS adphor_pqrs_qa.notification_state_audit(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 outbox_id uuid NOT NULL REFERENCES adphor_pqrs_qa.notification_outbox(id) ON DELETE RESTRICT,
 case_id uuid NOT NULL REFERENCES adphor_pqrs_qa.cases(id),
 previous_state text,current_state text NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT now(),
 actor_role text NOT NULL DEFAULT current_user
);
CREATE INDEX IF NOT EXISTS qa_outbox_state_audit_item_idx
 ON adphor_pqrs_qa.notification_state_audit(outbox_id,recorded_at);
ALTER TABLE adphor_pqrs_qa.notification_state_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON adphor_pqrs_qa.notification_state_audit FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON adphor_pqrs_qa.notification_state_audit TO service_role;
GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA adphor_pqrs_qa TO service_role;
CREATE OR REPLACE FUNCTION adphor_pqrs_qa.guard_notification_delivery()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_eligible boolean:=false;
BEGIN
 IF TG_OP='UPDATE' AND
    (NEW.id IS DISTINCT FROM OLD.id OR NEW.case_id IS DISTINCT FROM OLD.case_id
      OR NEW.event_type IS DISTINCT FROM OLD.event_type
      OR OLD.state='SENT') THEN
   RAISE EXCEPTION 'Notification identity and sent receipts are immutable' USING ERRCODE='42501';
 END IF;
 IF NEW.state='BLOCKED' THEN
   IF NEW.recipient_email IS NOT NULL OR NEW.provider_message_id IS NOT NULL
      OR NEW.attempts <> 0 OR NEW.blocked_reason IS NULL OR
      (TG_OP='UPDATE' AND OLD.state<>'BLOCKED') THEN
     RAISE EXCEPTION 'Blocked notifications cannot hold recipients or delivery receipts' USING ERRCODE='42501';
   END IF;
   RETURN NEW;
 END IF;
 SELECT EXISTS(
  SELECT 1 FROM adphor_pqrs_qa.notification_delivery_gate g
  WHERE g.singleton AND g.enabled AND g.provider_code<>'UNCONFIGURED'
    AND g.enabled_at IS NOT NULL AND g.enabled_by IS NOT NULL
 ) INTO v_eligible;
 IF NOT v_eligible THEN
   RAISE EXCEPTION 'QA email delivery is disabled' USING ERRCODE='42501';
 END IF;
 SELECT EXISTS(
  SELECT 1 FROM adphor_pqrs_qa.cases c
  JOIN adphor_pqrs_qa.recipient_routes r ON r.project_id=c.project_id
  JOIN adphor_pqrs_qa.recipient_candidate_reviews can ON can.project_id=c.project_id
  JOIN public.qa_pqrs_route_readiness ready ON ready.project_id=c.project_id
  JOIN public.qa_pqrs_recipient_review_requests review ON review.project_id=c.project_id
  WHERE c.id=NEW.case_id AND r.approved AND r.recipient_email=NEW.recipient_email
    AND r.approval_at IS NOT NULL AND r.approved_by IS NOT NULL
    AND can.candidate_email=r.recipient_email
    AND can.route_readiness='PENDING_APPROVAL'
    AND ready.readiness='PENDING_APPROVAL'
    AND review.status='APPROVED'
    AND review.reviewed_by IS NOT NULL AND review.reviewed_at IS NOT NULL
    AND review.reviewed_by<>review.requested_by
    AND review.source_reconciled_at=ready.last_reconciled_at
 ) INTO v_eligible;
 IF NOT v_eligible THEN
    RAISE EXCEPTION 'Property-specific approved delivery route not verified' USING ERRCODE='42501';
 END IF;
 IF TG_OP='INSERT' OR
  NOT ((OLD.state='BLOCKED' AND NEW.state='PENDING_QA_ONLY') OR
       (OLD.state='PENDING_QA_ONLY' AND NEW.state='SENDING') OR
       (OLD.state='SENDING' AND NEW.state IN ('SENT','FAILED')) OR
       (OLD.state='FAILED' AND NEW.state='PENDING_QA_ONLY')) THEN
    RAISE EXCEPTION 'Illegal notification state transition' USING ERRCODE='42501';
 END IF;
 IF TG_OP='UPDATE' AND OLD.state<>'BLOCKED' AND NEW.recipient_email IS DISTINCT FROM OLD.recipient_email THEN
   RAISE EXCEPTION 'Notification recipient cannot change after queue release' USING ERRCODE='42501';
 END IF;
 IF NEW.blocked_reason IS NOT NULL THEN
   RAISE EXCEPTION 'Released notification must clear blocked reason' USING ERRCODE='42501';
 END IF;
 IF NEW.state='SENT' AND
    (NEW.provider_message_id IS NULL OR length(btrim(NEW.provider_message_id))<4
      OR NEW.attempts<1) THEN
   RAISE EXCEPTION 'Sent notification requires provider receipt and attempt' USING ERRCODE='42501';
 END IF;
 IF NEW.state<>'SENT' AND NEW.provider_message_id IS NOT NULL THEN
   RAISE EXCEPTION 'Only sent notification may hold provider receipt' USING ERRCODE='42501';
 END IF;
 RETURN NEW;
END $function$;
REVOKE ALL ON FUNCTION adphor_pqrs_qa.guard_notification_delivery() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS qa_notification_delivery_guard ON adphor_pqrs_qa.notification_outbox;
CREATE TRIGGER qa_notification_delivery_guard BEFORE INSERT OR UPDATE
 ON adphor_pqrs_qa.notification_outbox FOR EACH ROW
 EXECUTE FUNCTION adphor_pqrs_qa.guard_notification_delivery();
CREATE OR REPLACE FUNCTION adphor_pqrs_qa.audit_notification_state()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
 IF TG_OP='INSERT' OR OLD.state IS DISTINCT FROM NEW.state THEN
   INSERT INTO adphor_pqrs_qa.notification_state_audit(outbox_id,case_id,previous_state,current_state,actor_role)
   VALUES(NEW.id,NEW.case_id,CASE WHEN TG_OP='INSERT' THEN NULL ELSE OLD.state END,NEW.state,session_user);
 END IF;
 RETURN NEW;
END $function$;
REVOKE ALL ON FUNCTION adphor_pqrs_qa.audit_notification_state() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS qa_notification_delivery_audit ON adphor_pqrs_qa.notification_outbox;
CREATE TRIGGER qa_notification_delivery_audit AFTER INSERT OR UPDATE
 ON adphor_pqrs_qa.notification_outbox FOR EACH ROW
 EXECUTE FUNCTION adphor_pqrs_qa.audit_notification_state();
