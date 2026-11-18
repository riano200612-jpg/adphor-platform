import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('../qa/pqrs/sql/20261118_native_mirror_qa.sql',import.meta.url),'utf8');
test('staging-only and no original Apps Script mutation',()=>{
 assert.match(sql,/QA ONLY/);assert.doesNotMatch(sql,/clasp push|script\.google\.com|CREATE TRIGGER.+_original/i);
});
test('per-column grants exclude project reassignment, actor spoofing and sensitive fields',()=>{
 assert.match(sql,/GRANT INSERT\(project_id,created_by/);
 assert.match(sql,/GRANT UPDATE\(status,priority,assignee,due_at,solution\)/);
 assert.doesNotMatch(sql,/GRANT (?:ALL|UPDATE) ON public\.pilot_pqrs TO authenticated/i);
 assert.doesNotMatch(sql,/GRANT INSERT\(case_id,body,actor_id\)/);
});
test('private copy receives no requester text, email or attachment',()=>{
 assert.match(sql,/NEW\.id::text/);assert.match(sql,/NEW\.kind/);
 assert.doesNotMatch(sql,/NEW\.(?:subject|description|owner|apartment|tower|attachment|email)/);
});
test('outbox stays blocked and no mail provider send is invoked',()=>{
 assert.match(sql,/'BLOCKED','DESTINATION_NOT_CERTIFIED'/);
 assert.doesNotMatch(sql,/MailApp\.sendEmail|GmailApp\.sendEmail|fetch\(['"]https:\/\//);
});
test('the SQL snapshot has a complete function statement',()=>{
 assert.ok(sql.includes('END $function$;'));
});
test('function has private schema and no public execution grant',()=>{
 assert.match(sql,/SECURITY DEFINER/);
 assert.match(sql,/REVOKE ALL ON FUNCTION adphor_pqrs_qa\.capture_native_pqrs\(\)/);
 assert.match(sql,/CREATE TRIGGER adphor_pqrs_qa_native_copy/);
});
