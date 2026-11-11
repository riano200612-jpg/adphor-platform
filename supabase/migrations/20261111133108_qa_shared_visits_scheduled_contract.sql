-- ADPHOR QA only: qfctnnnnltghepwujpdm. Additive; no historical imports.
-- Uses the reviewed scheduled-visit contract; no visitor/entry/exit fields invented.
create table public.qa_visits (
 project_id text not null references public.projects(id),
 request_id uuid not null,
 responsible_id uuid not null,
 motive text not null check(length(btrim(motive)) between 1 and 200),
 scheduled_at timestamptz not null,
 created_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now(),
 primary key(project_id,request_id),
 foreign key(project_id,responsible_id) references public.memberships(project_id,user_id)
);
create index qa_visits_project_schedule on public.qa_visits(project_id,scheduled_at,request_id);
alter table public.qa_visits enable row level security;
revoke all on public.qa_visits from public,anon,authenticated;
grant select,insert on public.qa_visits to authenticated;
create policy qa_visits_aal2 on public.qa_visits as restrictive for all to authenticated
 using(qa_identity_private.current_principal() is not null and (select auth.jwt()->>'aal')='aal2')
 with check(qa_identity_private.current_principal() is not null and (select auth.jwt()->>'aal')='aal2');
create policy qa_visits_member_read on public.qa_visits for select to authenticated
 using(public.project_role(project_id) is not null);
create policy qa_visits_authorized_create on public.qa_visits for insert to authenticated
 with check(created_by=(select auth.uid()) and public.project_role(project_id) in('admin','coordinator'));
create function public.qa_create_visit(p_project text,p_request uuid,p_responsible uuid,p_motive text,p_scheduled timestamptz)
 returns public.qa_visits language plpgsql security invoker set search_path='' as $$
declare saved public.qa_visits;
begin
 if qa_identity_private.current_principal() is null or (select auth.jwt()->>'aal') is distinct from 'aal2'
  or coalesce(public.project_role(p_project),'') not in ('admin','coordinator') then
  raise exception 'Visita no autorizada' using errcode='42501';
 end if;
 insert into public.qa_visits(project_id,request_id,responsible_id,motive,scheduled_at)
 values(p_project,p_request,p_responsible,btrim(p_motive),p_scheduled)
 on conflict(project_id,request_id) do nothing returning * into saved;
 if found then return saved;end if;
 select * into saved from public.qa_visits where project_id=p_project and request_id=p_request and created_by=(select auth.uid());
 if not found or (saved.responsible_id,saved.motive,saved.scheduled_at) is distinct from(p_responsible,btrim(p_motive),p_scheduled) then
  raise exception 'Conflicto de solicitud de visita' using errcode='23505';
 end if;
 return saved;
end;$$;
revoke all on function public.qa_create_visit(text,uuid,uuid,text,timestamptz) from public,anon,authenticated;
grant execute on function public.qa_create_visit(text,uuid,uuid,text,timestamptz) to authenticated;
