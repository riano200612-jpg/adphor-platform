-- ADPHOR QA only. Leases start empty and are granted per manifest path.
create table if not exists qa_identity_private.property_photo_import_leases (
 user_id uuid not null references auth.users(id),
 object_path text not null,
 expires_at timestamptz not null,
 primary key (user_id, object_path)
);
revoke all on qa_identity_private.property_photo_import_leases from public, anon, authenticated;

create or replace function qa_identity_private.can_import_property_photo(object_path text)
returns boolean language sql stable security definer set search_path = ''
as $$
 select (select auth.jwt()->>'aal') = 'aal2' and exists (
   select 1 from qa_identity_private.property_photo_import_leases l
   where l.user_id=(select auth.uid()) and l.object_path=$1 and l.expires_at>now()
 )
$$;
revoke all on function qa_identity_private.can_import_property_photo(text) from public, anon;
grant execute on function qa_identity_private.can_import_property_photo(text) to authenticated;

drop policy property_photos_read on storage.objects;
create policy property_photos_read on storage.objects for select to authenticated
using (bucket_id='property-photos' and (
 qa_identity_private.can_import_property_photo(name) or exists (
  select 1 from public.qa_property_photos p
  where p.approved and storage.objects.name=p.project_id||'/'||p.filename
 )
));

alter policy qa_property_photos_storage_scope on storage.objects to authenticated
using (bucket_id<>'property-photos' or (
 qa_identity_private.can_import_property_photo(name) or exists (
  select 1 from public.qa_property_photos p
  where p.approved and storage.objects.name=p.project_id||'/'||p.filename
 )
));

create policy qa_property_photo_import_insert on storage.objects for insert to authenticated
with check (bucket_id='property-photos' and qa_identity_private.can_import_property_photo(name));
create policy qa_property_photo_insert_scope on storage.objects as restrictive for insert to authenticated
with check (bucket_id<>'property-photos' or qa_identity_private.can_import_property_photo(name));

create policy qa_property_photo_import_bucket_metadata on storage.buckets for select to authenticated
using (id='property-photos' and qa_identity_private.can_import_property_photo('@bucket-metadata'));
