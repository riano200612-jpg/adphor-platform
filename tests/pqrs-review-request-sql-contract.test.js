import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('../qa/pqrs/sql/20261118_review_request_qa.sql',import.meta.url),'utf8');
test('QA-only migration does not alter originals or send emails',()=>{
 assert.match(sql,/ADPHOR QA only/);
 assert.doesNotMatch(sql,/MailApp|GmailApp|send_email|http_post|\bCOPY\b/);
});
test('require RLS and technical administrator session on route review',()=>{
 assert.match(sql,/ENABLE ROW LEVEL SECURITY/);
 assert.match(sql,/current_principal\(\)='technical_admin'/);
 assert.match(sql,/project_role\(project_id\)='admin'/);
});
test('limited browser grants never include mutation of approvals',()=>{
 assert.match(sql,/GRANT INSERT\(project_id,requested_by\)/);
 assert.doesNotMatch(sql,/GRANT (?:UPDATE|DELETE|ALL) ON public\.qa_pqrs_recipient_review_requests TO authenticated/);
});
test('duplicate pending requests and nonmatched routes blocked',()=>{
 assert.match(sql,/WHERE status='PENDING'/);
 assert.match(sql,/readiness='PENDING_APPROVAL'/);
});
test('review request never means authorization to deliver',()=>{
 assert.match(sql,/status text NOT NULL DEFAULT 'PENDING'/);
 assert.match(sql,/review_status_coherence/);
});
