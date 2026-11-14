-- ADPHOR QA only: private display names for existing Visit evidence.
-- No changes to Storage paths, bucket access, RLS or production.
begin;
alter table public.qa_visit_evidence
 add column file_name text,
 add constraint qa_visit_evidence_file_name_check check(
  file_name is null or (
   char_length(file_name) between 1 and 180
   and file_name=btrim(file_name)
   and file_name !~ '[[:cntrl:]]'
   and position('/' in file_name)=0
   and position(chr(92) in file_name)=0
   and position('<' in file_name)=0
   and position('>' in file_name)=0
  )
 );
grant insert(file_name) on public.qa_visit_evidence to authenticated;
commit;
