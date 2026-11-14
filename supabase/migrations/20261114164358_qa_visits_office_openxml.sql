-- ADPHOR QA only: Modern Office OpenXML documents in private Visits evidence.
-- No new project, no public bucket, no change to PQRS or production.
begin;
do $$ begin
 if not exists (select 1 from storage.buckets where id='qa-visit-evidence' and public=false and file_size_limit=20971520) then
  raise exception 'Private QA Visit bucket is unavailable or changed';
 end if;
end $$;
alter table public.qa_visit_evidence
 drop constraint qa_visit_evidence_media_type_check,
 drop constraint qa_visit_evidence_exact_path;
alter table public.qa_visit_evidence
 add constraint qa_visit_evidence_media_type_check check (media_type in ('image/jpeg','image/png','image/webp','video/mp4','video/webm','application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')),
 add constraint qa_visit_evidence_exact_path check (
  storage_path=project_id||'/visitas/'||request_id::text||'/'||uploaded_by::text||'/'||id::text||'.'||
  (case media_type
   when 'image/jpeg' then 'jpg'
   when 'image/png' then 'png'
   when 'image/webp' then 'webp'
   when 'video/mp4' then 'mp4'
   when 'video/webm' then 'webm'
   when 'application/pdf' then 'pdf'
   when 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' then 'docx'
   when 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' then 'xlsx'
   end)
 );
update storage.buckets set allowed_mime_types=array['image/jpeg','image/png','image/webp','video/mp4','video/webm','application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']::text[]
 where id='qa-visit-evidence' and public=false and file_size_limit=20971520;
drop policy qa_visit_object_upload on storage.objects;
create policy qa_visit_object_upload on storage.objects
 for insert to authenticated with check(
   bucket_id='qa-visit-evidence'
   and qa_identity_private.current_principal() is not null
   and (select auth.jwt()->>'aal')='aal2'
   and public.project_role(split_part(name,'/',1)) in ('admin','coordinator')
   and split_part(name,'/',2)='visitas'
   and split_part(name,'/',4)=(select auth.uid())::text
   and array_length(string_to_array(name,'/'),1)=5
   and split_part(name,'/',3) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
   and split_part(name,'/',5) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.](jpg|png|webp|mp4|webm|pdf|docx|xlsx)$'
   and exists(
     select 1 from public.qa_visits v
     where v.project_id=split_part(name,'/',1)
       and v.request_id::text=split_part(name,'/',3)
       and v.status in ('programada','en_ejecucion')
   )
 );
commit;
