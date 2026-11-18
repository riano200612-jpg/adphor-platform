import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('../qa/pqrs/sql/20261118_review_decisions_qa.sql',import.meta.url),'utf8');
test('review decisions cannot directly approve an email',()=>{
 assert.ok(sql.includes("NEW.status NOT IN ('CANCELLED','REJECTED')"));
 assert.ok(sql.includes('approval requires independent email ownership evidence'));
 assert.doesNotMatch(sql,/GRANT UPDATE\(status,reviewed_by\)/);
});
test('only requesting administrator can cancel, other administrator can reject',()=>{
 assert.ok(sql.includes("NEW.status='CANCELLED' AND OLD.requested_by<>v_actor"));
 assert.ok(sql.includes("NEW.status='REJECTED' AND OLD.requested_by=v_actor"));
});
test('require currently authorized technical administrator with live MFA session',()=>{
 assert.ok(sql.includes("qa_identity_private.current_principal() IS DISTINCT FROM 'technical_admin'"));
 assert.ok(sql.includes("public.project_role(OLD.project_id) IS DISTINCT FROM 'admin'"));
 assert.match(sql,/GRANT UPDATE\(status\) ON public\.qa_pqrs_recipient_review_requests TO authenticated/);
});
test('request identity cannot be rewritten and reviewer stamped by backend',()=>{
 for(const field of ['NEW.id IS DISTINCT FROM OLD.id','NEW.project_id IS DISTINCT FROM OLD.project_id',
 'NEW.requested_by IS DISTINCT FROM OLD.requested_by','NEW.source_reconciled_at IS DISTINCT FROM OLD.source_reconciled_at'])
 assert.ok(sql.includes(field));
 assert.ok(sql.includes('NEW.reviewed_by:=v_actor'));
 assert.ok(sql.includes('NEW.reviewed_at:=now()'));
});
test('private audit has RLS without browser write privilege',()=>{
 assert.ok(sql.includes('recipient_review_audit ENABLE ROW LEVEL SECURITY'));
 assert.ok(sql.includes('FROM PUBLIC,anon,authenticated,service_role'));
 assert.ok(sql.includes("new_status IN ('PENDING','CANCELLED','REJECTED')"));
 assert.doesNotMatch(sql,/GRANT (INSERT|UPDATE|DELETE|ALL) ON adphor_pqrs_qa.recipient_review_audit TO authenticated/);
});
test('migration operates only QA tables, never original Drive, production or email sender',()=>{
 assert.match(sql,/QA ONLY/);
 assert.doesNotMatch(sql,/GmailApp|MailApp|clasp push|script\.google\.com|\bhttp_post\b/);
});
