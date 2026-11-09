-- ISOLATED QA ONLY. Reviewable proposal, ends in ROLLBACK.
-- Prerequisites: baseline + Porto pilot_pqrs lifecycle tables. No production writes.
begin;
create table if not exists public.qa_case_evidence (
 id uuid primary key,
 project_id text not null references public.projects(id),
 case_id text not null,
 case_kind text not null check(case_kind in ('pqrs','recorridos')),
 storage_bucket text not null check(storage_bucket='qa-case-evidence'),
 storage_path text not null,
 media_type text not null check(media_type in ('image/jpeg','image/png','image/webp','video/mp4','video/webm','application/pdf')),
 file_bytes bigint not null check(file_bytes>0 and file_bytes<=20971520),
 uploaded_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 unique(storage_bucket,storage_path)
);
create index if not exists qa_case_evidence_project_case on public.qa_case_evidence(project_id,case_kind,case_id);
alter table public.qa_case_evidence enable row level security;
revoke all on public.qa_case_evidence from anon,authenticated;
grant select,insert on public.qa_case_evidence to authenticated;
create policy qa_evidence_read on public.qa_case_evidence for select to authenticated
 using(public.project_role(project_id) is not null);
create policy qa_evidence_insert on public.qa_case_evidence for insert to authenticated
 with check(uploaded_by=(select auth.uid())
 and public.project_role(project_id) in ('admin','coordinator','technician')
 and storage_bucket='qa-case-evidence'
 and split_part(storage_path,'/',1)=project_id
 and split_part(storage_path,'/',2)=case_kind
 and split_part(storage_path,'/',3)=case_id
 and split_part(storage_path,'/',4)=uploaded_by::text
 and array_length(string_to_array(storage_path,'/'),1)=5
 and split_part(storage_path,'/',5)=id::text||'.'||case media_type
  when 'image/jpeg' then 'jpg' when 'image/png' then 'png' when 'image/webp' then 'webp'
  when 'video/mp4' then 'mp4' when 'video/webm' then 'webm' when 'application/pdf' then 'pdf' end
 and ((case_kind='pqrs' and exists(select 1 from public.pilot_pqrs c where c.id::text=case_id and c.project_id=qa_case_evidence.project_id))
 or (case_kind='recorridos' and exists(select 1 from public.tickets c where c.id::text=case_id and c.project_id=qa_case_evidence.project_id)))
 and exists(select 1 from storage.objects o where o.bucket_id=storage_bucket and o.name=storage_path));
create function public.qa_evidence_quota() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtext(new.project_id||'/'||new.case_kind||'/'||new.case_id));
 if (select count(*) from public.qa_case_evidence e where e.project_id=new.project_id and e.case_kind=new.case_kind and e.case_id=new.case_id)>=5 then
 raise exception 'Límite de cinco evidencias por caso';
 end if;
 return new;
end$$;
revoke all on function public.qa_evidence_quota() from public;
create trigger qa_evidence_limit before insert on public.qa_case_evidence for each row execute function public.qa_evidence_quota();
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('qa-case-evidence','qa-case-evidence',false,20971520,array['image/jpeg','image/png','image/webp','video/mp4','video/webm','application/pdf']) on conflict(id) do nothing;
do $$begin
 if exists(select 1 from storage.buckets where id='qa-case-evidence' and
 (public is distinct from false or file_size_limit is distinct from 20971520 or
 allowed_mime_types is distinct from array['image/jpeg','image/png','image/webp','video/mp4','video/webm','application/pdf'])) then
 raise exception 'Existing evidence bucket configuration differs';end if;
end$$;
create policy qa_evidence_object_read on storage.objects for select to authenticated
 using(bucket_id='qa-case-evidence' and public.project_role(split_part(name,'/',1)) is not null);
create policy qa_evidence_object_insert on storage.objects for insert to authenticated
 with check(bucket_id='qa-case-evidence'
 and public.project_role(split_part(name,'/',1)) in ('admin','coordinator','technician')
 and split_part(name,'/',4)=(select auth.uid())::text
 and array_length(string_to_array(name,'/'),1)=5
 and ((split_part(name,'/',2)='pqrs' and exists(select 1 from public.pilot_pqrs c where c.id::text=split_part(name,'/',3) and c.project_id=split_part(name,'/',1)))
 or (split_part(name,'/',2)='recorridos' and exists(select 1 from public.tickets c where c.id::text=split_part(name,'/',3) and c.project_id=split_part(name,'/',1)))));
-- No overwrite/delete grants. Maintenance must audit unlinked private objects.
rollback;
