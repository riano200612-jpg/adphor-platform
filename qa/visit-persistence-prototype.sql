-- Isolated prototype. Review identity mapping and retention before migration.
create table visit_drafts (
  project_id text not null,
  request_id uuid not null,
  responsible_id uuid not null,
  motive text not null check (length(btrim(motive)) between 1 and 200),
  scheduled_at timestamptz not null,
  created_by uuid not null default auth.uid(),
  primary key (project_id, request_id),
  foreign key (project_id, responsible_id) references memberships(project_id, user_id)
);
alter table visit_drafts enable row level security;
grant select, insert on visit_drafts to authenticated;
create policy visit_draft_read on visit_drafts for select to authenticated using (
  auth.jwt()->>'aal' = 'aal2' and exists (
    select 1 from memberships m where m.project_id = visit_drafts.project_id and m.user_id = auth.uid()
  )
);
create policy visit_draft_create on visit_drafts for insert to authenticated with check (
  created_by = auth.uid() and auth.jwt()->>'aal' = 'aal2' and exists (
    select 1 from memberships m where m.project_id = visit_drafts.project_id and m.user_id = auth.uid()
      and m.role in ('admin','coordinator')
  )
);

create function public.save_visit_draft(
  p_project text, p_request uuid, p_responsible uuid, p_motive text, p_scheduled timestamptz
) returns public.visit_drafts language plpgsql security invoker set search_path = '' as $$
declare saved public.visit_drafts;
begin
  insert into public.visit_drafts (project_id, request_id, responsible_id, motive, scheduled_at)
  values (p_project, p_request, p_responsible, btrim(p_motive), p_scheduled)
  on conflict (project_id, request_id) do nothing
  returning * into saved;
  if found then return saved; end if;

  select * into saved from public.visit_drafts
  where project_id = p_project and request_id = p_request and created_by = auth.uid();
  if not found or (saved.responsible_id, saved.motive, saved.scheduled_at)
      is distinct from (p_responsible, btrim(p_motive), p_scheduled) then
    raise exception 'Conflicto de clave de solicitud' using errcode = '23505';
  end if;
  return saved;
end;
$$;
revoke execute on function public.save_visit_draft(text,uuid,uuid,text,timestamptz) from public;
grant execute on function public.save_visit_draft(text,uuid,uuid,text,timestamptz) to authenticated;
