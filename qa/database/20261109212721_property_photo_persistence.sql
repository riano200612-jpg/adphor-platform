-- Apply only to ADPHOR QA (qfctnnnnltghepwujpdm).
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('property-photos','property-photos',false,10485760,array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

do $$
begin
 if not exists (
   select 1 from storage.buckets where id='property-photos' and public=false
   and file_size_limit=10485760 and allowed_mime_types=array['image/jpeg','image/png','image/webp']
 ) then
   raise exception 'Unexpected property-photos bucket configuration';
 end if;
end $$;

create table if not exists public.qa_property_photos (
 project_id text primary key references public.projects(id),
 source_id text not null unique,
 source_sha256 text not null check (source_sha256 ~ '^[a-f0-9]{64}$'),
 filename text not null check (filename ~ '^[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp)$'),
 approved boolean not null default false,
 approved_by uuid references auth.users(id),
 approved_at timestamptz,
 check (not approved or (approved_by is not null and approved_at is not null))
);

alter table public.qa_property_photos enable row level security;
revoke all on public.qa_property_photos from public, anon, authenticated;
grant select on public.qa_property_photos to authenticated;
drop policy if exists qa_property_photos_read on public.qa_property_photos;
create policy qa_property_photos_read on public.qa_property_photos for select to authenticated
using (approved and (select qa_identity_private.current_principal()) is not null
 and exists (select 1 from public.memberships m where m.project_id=qa_property_photos.project_id
 and m.user_id=(select auth.uid())));

drop policy if exists property_photos_read on storage.objects;
create policy property_photos_read on storage.objects for select to authenticated
using (bucket_id='property-photos');

drop policy if exists qa_property_photos_storage_scope on storage.objects;
create policy qa_property_photos_storage_scope on storage.objects as restrictive for select to authenticated
using (bucket_id <> 'property-photos' or exists (
 select 1 from public.qa_property_photos p
 where p.approved and storage.objects.name=p.project_id||'/'||p.filename
));
