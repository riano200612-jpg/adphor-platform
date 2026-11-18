-- This QA-only verification always rolls back synthetic records.
BEGIN;
DO $validate$
DECLARE case_uuid uuid;notice_id uuid;rejected boolean;ext text:='QA-GATE-TEST-'||gen_random_uuid()::text;
BEGIN
 SELECT i.case_id INTO case_uuid FROM adphor_pqrs_qa.ingest_case_qa('contract_test',ext,'source-1',now(),'queja','alta') i;
 SELECT o.id INTO notice_id FROM adphor_pqrs_qa.notification_outbox o WHERE o.case_id=case_uuid;
 IF notice_id IS NULL THEN RAISE EXCEPTION 'missing notice'; END IF;
 IF (SELECT count(*) FROM adphor_pqrs_qa.notification_state_audit a WHERE a.outbox_id=notice_id AND a.current_state='BLOCKED')<>1
 THEN RAISE EXCEPTION 'audit not captured'; END IF;
 rejected:=false;
 BEGIN
  UPDATE adphor_pqrs_qa.notification_outbox SET state='PENDING_QA_ONLY',recipient_email='synthetic@example.invalid',blocked_reason=NULL WHERE id=notice_id;
 EXCEPTION WHEN insufficient_privilege THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'notice transitioned despite gate disabled'; END IF;
 rejected:=false;
 BEGIN
  UPDATE adphor_pqrs_qa.notification_outbox SET state='SENT',recipient_email='synthetic@example.invalid',blocked_reason=NULL,attempts=1,provider_message_id='FAKE0001' WHERE id=notice_id;
 EXCEPTION WHEN insufficient_privilege THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'forged provider receipt accepted'; END IF;
 rejected:=false;
 BEGIN
  UPDATE adphor_pqrs_qa.notification_outbox SET recipient_email='synthetic@example.invalid' WHERE id=notice_id;
 EXCEPTION WHEN insufficient_privilege THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'blocked notice recipient injection accepted'; END IF;
 IF (SELECT state FROM adphor_pqrs_qa.notification_outbox WHERE id=notice_id)<>'BLOCKED' THEN RAISE EXCEPTION 'state was modified'; END IF;
 IF has_table_privilege('authenticated','adphor_pqrs_qa.notification_state_audit','SELECT')
 OR has_table_privilege('authenticated','adphor_pqrs_qa.notification_delivery_gate','SELECT')
 THEN RAISE EXCEPTION 'private data exposed'; END IF;
 IF (SELECT enabled FROM adphor_pqrs_qa.notification_delivery_gate WHERE singleton) THEN
  RAISE EXCEPTION 'global gate unexpectedly enabled'; END IF;
END $validate$;
SELECT 'QA_NOTIFICATION_GUARD_PASS' AS result;
ROLLBACK;
