-- ADPHOR QA: fotografías privadas de copropiedades.
-- Aplicar únicamente tras auditoría de políticas y autorización.

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'property-photos',
  'property-photos',
  false,
  10485760,
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do nothing;

-- Lectura exclusiva para usuarios autenticados
-- con membresía autorizada en la copropiedad.
create policy property_photos_read
on storage.objects
for select
to authenticated
using (
  bucket_id = 'property-photos'
  and array_length(string_to_array(name, '/'), 1) = 2
  and split_part(name, '/', 1) <> ''
  and split_part(name, '/', 2) <> ''
  and public.project_role(
    split_part(name, '/', 1)
  ) is not null
);

-- No se habilita INSERT, UPDATE ni DELETE para usuarios
-- normales. La importación será administrativa y auditada.
