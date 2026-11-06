-- Isolated ADPHOR QA only. No people, emails, calendar IDs or credentials in Git.
begin;
create table public.qa_staff_members (
 id text primary key check(id ~ '^delegate-[0-9]+$'),
 name text not null check(length(btrim(name)) between 1 and 160),
 role_code text not null, role_label text not null,
 functions text[] not null default '{}', active boolean not null default false,
 photo_path text, photo_sha256 text check(photo_sha256 ~ '^[a-f0-9]{64}$'),
 source_sha256 text not null check(source_sha256 ~ '^[a-f0-9]{64}$'),
 imported_at timestamptz not null default now(),
 check((photo_path is null)=(photo_sha256 is null)),
 check(photo_path is null or (photo_path=id||'/'||photo_sha256||'.jpg' or photo_path=id||'/'||photo_sha256||'.jpeg'
  or photo_path=id||'/'||photo_sha256||'.png' or photo_path=id||'/'||photo_sha256||'.webp'))
);
create table public.qa_staff_assignments (
 project_id text not null references public.projects(id),
 staff_id text not null references public.qa_staff_members(id),
 relationship text not null check(relationship in ('delegate','coordinator','support')),
 primary key(project_id,staff_id)
);
create index qa_staff_assignments_person on public.qa_staff_assignments(staff_id,project_id);
alter table public.qa_staff_members enable row level security;
alter table public.qa_staff_assignments enable row level security;
revoke all on public.qa_staff_members,public.qa_staff_assignments from public,anon,authenticated;
grant select on public.qa_staff_members,public.qa_staff_assignments to authenticated;
create policy qa_staff_assignments_read on public.qa_staff_assignments for select to authenticated
 using(public.project_role(project_id) is not null);
create policy qa_staff_members_read on public.qa_staff_members for select to authenticated
 using(active and exists(select 1 from public.qa_staff_assignments a
 where a.staff_id=qa_staff_members.id and public.project_role(a.project_id) is not null));
create view public.qa_staff_directory with (security_invoker=true) as
 select a.project_id,a.relationship,m.id,m.name,m.role_code,m.role_label,m.functions,m.photo_path
 from public.qa_staff_assignments a join public.qa_staff_members m on m.id=a.staff_id
 where m.active;
revoke all on public.qa_staff_directory from public,anon,authenticated;
grant select on public.qa_staff_directory to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('qa-staff-photos','qa-staff-photos',false,10485760,array['image/jpeg','image/png','image/webp'])
 on conflict(id) do nothing;
do $$begin
 if exists(select 1 from storage.buckets where id='qa-staff-photos' and public is distinct from false)
 then raise exception 'QA staff bucket must remain private';end if;
end$$;
create policy qa_staff_photo_read on storage.objects for select to authenticated
 using(bucket_id='qa-staff-photos' and exists(select 1 from public.qa_staff_members m
 where m.active and m.photo_path=storage.objects.name));
-- Import and photo writes are administrative only; no client write grants/policies.
commit;
