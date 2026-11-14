-- ADPHOR Integral QA: corporate roster visibility is not employment status or account access.
-- Existing staff, assignments, photo objects and access policies remain untouched.
begin;

alter table public.qa_staff_members
  add column if not exists carousel_visible boolean not null default true;

create table public.qa_staff_carousel_audit (
  id bigint generated always as identity primary key,
  staff_id text not null references public.qa_staff_members(id),
  actor_id uuid not null references auth.users(id),
  previous_visible boolean not null,
  new_visible boolean not null,
  changed_at timestamptz not null default now(),
  check (previous_visible <> new_visible)
);
create index qa_staff_carousel_audit_lookup
  on public.qa_staff_carousel_audit (staff_id, changed_at desc);

alter table public.qa_staff_carousel_audit enable row level security;
revoke all on public.qa_staff_carousel_audit from public, anon, authenticated;

-- Only a confirmed, active corporate principal with real MFA AAL2 is authorized.
-- This intentionally does not trust the client role, project membership or user metadata.
create function public.qa_carousel_can_manage()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select qa_identity_private.current_principal()) in ('technical_admin','general_admin'),
    false
  ) and (select auth.uid()) is not null;
$$;
revoke all on function public.qa_carousel_can_manage() from public, anon, authenticated;
grant execute on function public.qa_carousel_can_manage() to authenticated;

-- Read-only institutional directory: includes staff without property assignments.
-- Managers can review hidden entries; regular authorized corporate principals cannot.
create function public.qa_carousel_directory()
returns table (
  id text, name text, role_code text, role_label text, department text,
  functions text[], photo_path text, assigned_properties integer,
  carousel_visible boolean
)
language sql stable security definer set search_path = ''
as $$
  select m.id, m.name, m.role_code, m.role_label,
    case
      when m.role_label ilike '%tecnolog%' then 'Tecnología'
      when m.role_label ilike '%gerent%' then 'Gerencia'
      when m.role_label ilike '%coordin%' then 'Coordinación'
      when m.role_label ilike '%delegad%' then 'Delegados'
      when m.role_label ilike '%operativ%' or m.role_label ilike '%operacion%'
        or m.role_label ilike '%operaacion%' then 'Operaciones'
      else 'Otras áreas'
    end as department,
    m.functions, m.photo_path,
    (select count(*)::integer from public.qa_staff_assignments a
      where a.staff_id=m.id) as assigned_properties,
    m.carousel_visible
  from public.qa_staff_members m
  where m.active
    and (select qa_identity_private.current_principal()) is not null
    and (m.carousel_visible or (select public.qa_carousel_can_manage()))
  order by department, m.name, m.id;
$$;
revoke all on function public.qa_carousel_directory() from public, anon, authenticated;
grant execute on function public.qa_carousel_directory() to authenticated;

-- Atomic, auditable toggle. An idempotent retry does not create a fake audit event.
create function public.qa_carousel_set_visibility(p_staff_id text, p_visible boolean)
returns boolean
language plpgsql volatile security definer set search_path = ''
as $$
declare old_visible boolean;
begin
  if not (select public.qa_carousel_can_manage()) then
    raise exception 'No autorizado para administrar el carrusel corporativo.'
      using errcode='42501';
  end if;
  if p_staff_id is null or p_visible is null then
    raise exception 'Colaborador y estado requeridos.' using errcode='22023';
  end if;

  select m.carousel_visible into old_visible
    from public.qa_staff_members m
    where m.id=p_staff_id and m.active
    for update;
  if not found then
    raise exception 'Colaborador corporativo inexistente o inactivo.'
      using errcode='22023';
  end if;
  if old_visible is distinct from p_visible then
    update public.qa_staff_members
      set carousel_visible=p_visible where id=p_staff_id;
    insert into public.qa_staff_carousel_audit
      (staff_id, actor_id, previous_visible, new_visible)
      values (p_staff_id, (select auth.uid()), old_visible, p_visible);
  end if;
  return p_visible;
end;
$$;
revoke all on function public.qa_carousel_set_visibility(text,boolean)
  from public, anon, authenticated;
grant execute on function public.qa_carousel_set_visibility(text,boolean)
  to authenticated;

create function public.qa_carousel_history()
returns table(change_id bigint, staff_id text, staff_name text,
  visible_before boolean, visible_after boolean, changed_at timestamptz)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not (select public.qa_carousel_can_manage()) then
    raise exception 'No autorizado para consultar el historial del carrusel.'
      using errcode='42501';
  end if;
  return query
    select a.id, a.staff_id, m.name, a.previous_visible,
      a.new_visible, a.changed_at
    from public.qa_staff_carousel_audit a
    join public.qa_staff_members m on m.id=a.staff_id
    order by a.changed_at desc, a.id desc
    limit 100;
end;
$$;
revoke all on function public.qa_carousel_history()
  from public, anon, authenticated;
grant execute on function public.qa_carousel_history() to authenticated;

-- Signed photo requests still require Storage's own row policy.
-- This grants only roster photos visible to the caller, never unrelated files.
create policy qa_corporate_carousel_photo_read on storage.objects
for select to authenticated
using (
  bucket_id='qa-staff-photos'
  and exists (
    select 1 from public.qa_carousel_directory() d
    where d.photo_path = storage.objects.name
  )
);
commit;
