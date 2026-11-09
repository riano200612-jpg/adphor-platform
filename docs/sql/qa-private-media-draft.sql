-- QA ISOLATED ONLY: reviewable draft, deliberately rolls back.
-- Requires projects, memberships, auth.users and project_role from baseline.
-- No source records, personal data or credentials are embedded here.
begin;
create table public.qa_property_photos (
 project_id text primary key references public.projects(id),
 source_id text not null,
 source_sha256 text not null check(source_sha256 ~ '^[a-f0-9]{64}$'),
 filename text not null check(filename ~ '^[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp)$'),
 approved boolean not null default false,
 approved_by uuid references auth.users(id),
 approved_at timestamptz,
 check(not approved or (approved_by is not null and approved_at is not null))
);
create table public.qa_project_companions (
 project_id text not null references public.projects(id),
 id text not null,
 name text not null,
 role text not null check(role in ('GG','GF','GT','CG','CO','A','CZB','CZM','CZN','OV','AI')),
 role_label text not null,
 source_sha256 text not null check(source_sha256 ~ '^[a-f0-9]{64}$'),
 photo_filename text check(photo_filename ~ '^[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp)$'),
 approved boolean not null default false,
 approved_by uuid references auth.users(id),
 approved_at timestamptz,
 primary key(project_id,id),
 check(not approved or (approved_by is not null and approved_at is not null))
);
alter table public.qa_property_photos enable row level security;
alter table public.qa_project_companions enable row level security;
revoke all on public.qa_property_photos,public.qa_project_companions from anon,authenticated;
grant select on public.qa_property_photos,public.qa_project_companions to authenticated;
create policy qa_property_photos_read on public.qa_property_photos for select to authenticated
 using(approved and public.project_role(project_id) is not null);
create policy qa_companions_read on public.qa_project_companions for select to authenticated
 using(approved and public.project_role(project_id) is not null);
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values ('property-photos','property-photos',false,10485760,array['image/jpeg','image/png','image/webp']),
 ('staff-photos','staff-photos',false,10485760,array['image/jpeg','image/png','image/webp'])
 on conflict(id) do nothing;
do $$begin
 if exists(select 1 from storage.buckets where id in ('property-photos','staff-photos')
 and (public is distinct from false or file_size_limit is distinct from 10485760
 or allowed_mime_types is distinct from array['image/jpeg','image/png','image/webp'])) then
 raise exception 'Existing private-media bucket configuration differs; review before applying';
 end if;
end$$;
-- Replace the older broad property-photo policy if already installed in isolated QA.
drop policy if exists property_photos_read on storage.objects;
create policy property_photos_read on storage.objects for select to authenticated
 using(bucket_id='property-photos' and exists(
 select 1 from public.qa_property_photos p
 where p.approved and storage.objects.name=p.project_id||'/'||p.filename));
create policy staff_photos_read on storage.objects for select to authenticated
 using(bucket_id='staff-photos' and exists(
 select 1 from public.qa_project_companions p
 where p.approved and storage.objects.name=p.project_id||'/'||p.photo_filename));
-- Import with an audited administrative workflow only. No client write grants.
-- Review all other storage policies for permissive OR predicates before release.
rollback;
