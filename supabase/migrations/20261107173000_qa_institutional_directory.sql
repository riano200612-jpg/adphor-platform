-- QA only. Populate these allowlists after review of the authorized roster and audience.
create table public.qa_institutional_staff (
  staff_id text primary key references public.qa_staff_members(id),
  department text not null check (length(btrim(department)) between 1 and 100)
);
create table public.qa_institutional_viewers (
  user_id uuid primary key references auth.users(id)
);
alter table public.qa_institutional_staff enable row level security;
alter table public.qa_institutional_viewers enable row level security;
revoke all on public.qa_institutional_staff, public.qa_institutional_viewers from public, anon, authenticated;

create function public.qa_institutional_directory()
returns table(id text, name text, role_label text, department text, functions text[], photo_path text)
language sql stable security definer set search_path = ''
as $$
  select m.id, m.name, m.role_label, s.department, m.functions, m.photo_path
  from public.qa_institutional_staff s
  join public.qa_staff_members m on m.id = s.staff_id
  where m.active
    and qa_identity_private.current_principal() is not null
    and exists (select 1 from public.qa_institutional_viewers v where v.user_id = auth.uid())
  order by s.department, m.name, m.id
$$;
revoke all on function public.qa_institutional_directory() from public, anon, authenticated;
grant execute on function public.qa_institutional_directory() to authenticated;

create policy qa_institutional_photo_read on storage.objects for select to authenticated
using (bucket_id = 'qa-staff-photos' and exists (
  select 1 from public.qa_institutional_directory() d where d.photo_path = storage.objects.name
));
