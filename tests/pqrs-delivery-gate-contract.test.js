import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const migration=readFileSync(new URL('../qa/pqrs/sql/20261118_notification_delivery_gate_qa.sql',import.meta.url),'utf8');
const check=readFileSync(new URL('../qa/pqrs/sql/test_20261118_notification_delivery_gate_qa.sql',import.meta.url),'utf8');
test('global email gate defaults disabled and requires provider identity',()=>{
 assert.match(migration,/enabled boolean NOT NULL DEFAULT false/);
 assert.match(migration,/provider_code text NOT NULL DEFAULT 'UNCONFIGURED'/);
 assert.match(migration,/enabled_at IS NOT NULL AND enabled_by IS NOT NULL/);
});
test('outbox cannot advance without global gate and approved property mapping',()=>{
 assert.match(migration,/IF NOT v_eligible THEN/);
 for(const x of ['JOIN adphor_pqrs_qa.recipient_routes','JOIN adphor_pqrs_qa.recipient_candidate_reviews',
  'JOIN public.qa_pqrs_route_readiness','JOIN public.qa_pqrs_recipient_review_requests',
  "review.status='APPROVED'","review.reviewed_by<>review.requested_by",
  'review.source_reconciled_at=ready.last_reconciled_at'])
 assert.ok(migration.includes(x),'missing authorization clause '+x);
});
test('blocked notifications cannot have an email recipient or receipt',()=>{
 assert.match(migration,/IF NEW.state='BLOCKED' THEN/);
 assert.match(migration,/NEW.recipient_email IS NOT NULL/);
 assert.match(migration,/NEW.provider_message_id IS NOT NULL/);
});
test('strict state machine and provider receipt required',()=>{
 for(const x of ["OLD.state='BLOCKED' AND NEW.state='PENDING_QA_ONLY'",
 "OLD.state='PENDING_QA_ONLY' AND NEW.state='SENDING'",
 "OLD.state='SENDING' AND NEW.state IN ('SENT','FAILED')",
 "OLD.state='FAILED' AND NEW.state='PENDING_QA_ONLY'",
 'NEW.attempts<1'])assert.ok(migration.includes(x));
});
test('route and case identifiers are immutable',()=>{
 assert.match(migration,/NEW.case_id IS DISTINCT FROM OLD.case_id/);
 assert.match(migration,/NEW.recipient_email IS DISTINCT FROM OLD.recipient_email/);
 assert.match(migration,/OLD.state='SENT'/);
});
test('audit and global controls stay private',()=>{
 assert.match(migration,/notification_state_audit ENABLE ROW LEVEL SECURITY/);
 assert.match(migration,/notification_delivery_gate ENABLE ROW LEVEL SECURITY/);
 assert.match(migration,/REVOKE ALL ON adphor_pqrs_qa.notification_state_audit FROM PUBLIC,anon,authenticated,service_role/);
 assert.match(migration,/SECURITY DEFINER/);
 assert.match(migration,/SET search_path TO ''/);
});
test('synthetic negative tests must explicitly rollback',()=>{
 assert.match(check,/^BEGIN;/);assert.match(check,/ROLLBACK;/);
 for(const x of ['forged provider receipt accepted','recipient injection accepted',
 'notice transitioned despite gate disabled'])assert.ok(check.includes(x));
});
test('no real mail send or original Jose file modification',()=>{
 assert.doesNotMatch(migration,/MailApp\.sendEmail|GmailApp\.sendEmail|https:\/\/script\.google\.com|\bclasp push\b/);
 assert.doesNotMatch(check,/\bCOMMIT\b|\bCREATE ROLE\b/);
});
