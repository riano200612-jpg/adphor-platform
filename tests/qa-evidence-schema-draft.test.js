import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const draft=readFileSync(new URL('../docs/sql/qa-case-evidence-draft.sql',import.meta.url),'utf8');
test('evidence schema proposal cannot silently deploy to a database',()=>{
 assert.match(draft,/begin;/i);
 assert.match(draft,/rollback;/i);
 assert.match(draft,/enable row level security/i);
 assert.match(draft,/revoke all on public.qa_case_evidence from anon, authenticated/i);
 assert.doesNotMatch(draft,/create policy/i);
});
test('private evidence references tenant and uploader, not exposed public URL',()=>{
 assert.match(draft,/project_id text not null references public.projects\(id\)/i);
 assert.match(draft,/uploaded_by uuid not null references auth.users\(id\)/i);
 assert.match(draft,/unique\(storage_bucket, storage_path\)/i);
 assert.doesNotMatch(draft,/public_url|signed_url/i);
});
