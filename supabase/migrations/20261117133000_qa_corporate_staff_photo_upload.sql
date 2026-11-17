-- ADPHOR QA Integral: private, auditable corporate staff photo import.
-- Existing photo objects and employment/visibility flags remain unchanged.
begin;

create table public.qa_staff_photo_import_audit (
  id bigint generated always as identity primary key,
  staff_id text not null references public.qa_staff_members(id),
  actor_id uuid not null references auth.users(id),
  photo_path text not null,
  imported_at timestamptz not null default now()
);
create index qa_staff_photo_import_audit_staff_idx
  on public.qa_staff_photo_import_audit(staff_id, imported_at desc);
alter table public.qa_staff_photo_import_audit enable row level security;
revoke all on public.qa_staff_photo_import_audit from public, anon, authenticated;

-- Only active corporate administrators with AAL2 may add fresh private files.
-- An existing staff portrait can never be overwritten through this path.
create policy qa_corporate_staff_photo_import_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'qa-staff-photos'
  and (select public.qa_carousel_can_manage())
  and name ~ '^delegate-[0-9]+/[a-f0-9]{64}[.](jpg|jpeg|png|webp)$'
  and exists (
    select 1 from public.qa_carousel_directory() d
    where d.id = split_part(storage.objects.name,'/',1)
      and d.photo_path is null
      and length(trim(d.name)) >= 3
  )
);

create function public.qa_carousel_attach_photo(
  p_staff_id text, p_sha256 text, p_extension text
) returns text
language plpgsql volatile security definer set search_path = ''
as $$
declare
  original_path text;
  object_name text;
  object_size bigint;
  object_type text;
  member_name text;
begin
  if not (select public.qa_carousel_can_manage()) then
    raise exception 'Sin autorización corporativa y MFA AAL2.' using errcode='42501';
  end if;
  if p_staff_id is null or p_staff_id !~ '^delegate-[0-9]+$'
    or p_sha256 is null or p_sha256 !~ '^[a-f0-9]{64}$'
    or p_extension is null or p_extension not in ('jpg','jpeg','png','webp') then
    raise exception 'Archivo o colaborador inválido.' using errcode='22023';
  end if;
  object_name := p_staff_id || '/' || p_sha256 || '.' || p_extension;
  select m.photo_path, m.name into original_path, member_name
    from public.qa_staff_members m
    where m.id=p_staff_id and m.active
    for update;
  if not found or length(trim(member_name)) < 3 then
    raise exception 'Identidad de colaborador pendiente de verificación.'
      using errcode='22023';
  end if;
  if original_path is not null then
    raise exception 'Este colaborador ya tiene fotografía y no se reemplazará.'
      using errcode='23505';
  end if;

  select (o.metadata->>'size')::bigint, o.metadata->>'mimetype'
    into object_size, object_type
    from storage.objects o
    where o.bucket_id='qa-staff-photos' and o.name=object_name;
  if not found or object_size is null or object_size <= 0 or object_size > 10485760
    or object_type not in ('image/jpeg','image/png','image/webp')
    or (p_extension in ('jpg','jpeg') and object_type <> 'image/jpeg')
    or (p_extension = 'png' and object_type <> 'image/png')
    or (p_extension = 'webp' and object_type <> 'image/webp') then
    raise exception 'El archivo privado no existe o no cumple las validaciones.'
      using errcode='22023';
  end if;
  update public.qa_staff_members
    set photo_path=object_name, photo_sha256=p_sha256
    where id=p_staff_id and active;
  insert into public.qa_staff_photo_import_audit(staff_id,actor_id,photo_path)
    values (p_staff_id,(select auth.uid()),object_name);
  return object_name;
end;
$$;
revoke all on function public.qa_carousel_attach_photo(text,text,text)
  from public, anon, authenticated;
grant execute on function public.qa_carousel_attach_photo(text,text,text)
  to authenticated;
commit;
