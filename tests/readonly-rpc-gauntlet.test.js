import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sql = readFileSync(new URL('../qa/security/readonly-rpc-gauntlet.sql', import.meta.url),'utf8');
test('readonly audit covers all five privileged functions', () => {
  for(const fn of ['finalize_monthly_report','monthly_report','project_role','ticket_command','visible_profile'])
    assert.ok(sql.includes("'"+fn+"'"), fn);
});
test('readonly audit inspects RLS, grants, triggers and exact definitions',()=>{
  for(const token of ['pg_policies','role_table_grants','pg_trigger','pg_get_functiondef','has_function_privilege'])
    assert.ok(sql.includes(token),token);
});
test('readonly SQL contains no executable DDL or mutation',()=>{
  const executable = sql.split('\n').filter(line=>!/^\s*--/.test(line)).join('\n');
  assert.doesNotMatch(executable,/\b(?:ALTER|DROP|CREATE|TRUNCATE|DELETE|INSERT|UPDATE|GRANT|REVOKE|CALL|DO)\s+(?:TABLE|SCHEMA|FUNCTION|ROLE|POLICY|TRIGGER|ON|INTO|FROM|PUBLIC|authenticated)?\b/i);
});
