-- Apply after 202610190001_workflow.sql. Does not delete tickets or evidence.
begin;
alter table public.projects add column if not exists is_demo boolean not null default false;
create table public.ticket_events (
  ticket_id uuid not null references public.tickets(id),
  event_no bigint not null,
  project_id text not null references public.projects(id),
  happened_at timestamptz not null,
  action text not null,
  status text,
  due_date date,
  actor_id uuid,
  detail jsonb not null,
  primary key(ticket_id,event_no)
);
create index ticket_events_project_time on public.ticket_events(project_id,happened_at);
create index ticket_events_ticket_time on public.ticket_events(ticket_id,happened_at desc,event_no desc);
create index tickets_project_status_due on public.tickets(project_id,status,due_date);
create index tickets_project_assignee on public.tickets(project_id,assignee,created_at desc);
alter table public.ticket_events enable row level security;
revoke all on public.ticket_events from anon,authenticated;
grant select on public.ticket_events to authenticated;
create policy event_read on public.ticket_events for select to authenticated using(public.project_role(project_id) is not null);

create function public.sync_ticket_events() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if tg_op='UPDATE' and (jsonb_array_length(new.history)<jsonb_array_length(old.history)
    or exists(select 1 from jsonb_array_elements(old.history) with ordinality h(value,n) where new.history->(h.n::integer-1) is distinct from h.value)) then
    raise exception 'El historial es acumulativo: no se pueden reemplazar eventos anteriores.';
  end if;
  insert into public.ticket_events(ticket_id,event_no,project_id,happened_at,action,status,due_date,actor_id,detail)
  select new.id,h.n,new.project_id,(h.value->>'at')::timestamptz,coalesce(h.value->>'action','unknown'),
    coalesce(h.value->>'status',case h.value->>'action' when 'create' then 'Pendiente' when 'start' then 'En proceso' when 'submit' then 'Por verificar' when 'close' then 'Cerrada' when 'reopen' then 'En proceso' end),
    nullif(h.value->>'due_date','')::date,nullif(h.value->>'actor_id','')::uuid,h.value
  from jsonb_array_elements(new.history) with ordinality h(value,n)
  on conflict(ticket_id,event_no) do nothing;
  return new;
end;
$$;
revoke all on function public.sync_ticket_events() from public,anon,authenticated;
create trigger tickets_events_sync after insert or update on public.tickets for each row execute function public.sync_ticket_events();
-- Backfill retained history using the same trigger; original audit text is preserved.
update public.tickets set history=history;

create table public.monthly_reports (
  project_id text not null references public.projects(id),
  month date not null check(extract(day from month)=1),
  content jsonb not null,
  finalized_at timestamptz not null default now(),
  finalized_by uuid not null references public.profiles(id),
  primary key(project_id,month)
);
alter table public.monthly_reports enable row level security;
revoke all on public.monthly_reports from anon,authenticated;
grant select on public.monthly_reports to authenticated;
create policy monthly_read on public.monthly_reports for select to authenticated using(public.project_role(project_id) is not null);

create function public.monthly_report(project text, report_month date) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  start_at timestamptz; end_at timestamptz; cutoff timestamptz;
  result jsonb; saved public.monthly_reports; demo boolean;
begin
  if auth.uid() is null or public.project_role(project) is null then raise exception 'No tienes acceso a esta copropiedad.'; end if;
  if report_month is null or extract(day from report_month)<>1 or report_month > (now() at time zone 'America/Bogota')::date then raise exception 'Selecciona un mes válido hasta el mes actual.'; end if;
  select * into saved from public.monthly_reports where project_id=project and month=report_month;
  if found then return saved.content || jsonb_build_object('frozen',true,'finalized_at',saved.finalized_at); end if;
  select is_demo into demo from public.projects where id=project;
  start_at := report_month::timestamp at time zone 'America/Bogota';
  end_at := (report_month+interval '1 month')::timestamp at time zone 'America/Bogota';
  cutoff := least(end_at,now());
  with cases as (
    select t.*,
      coalesce((select e.status from public.ticket_events e where e.ticket_id=t.id and e.happened_at<start_at and e.status is not null order by e.happened_at desc,e.event_no desc limit 1),'Pendiente') as opening_status,
      coalesce((select e.status from public.ticket_events e where e.ticket_id=t.id and e.happened_at<cutoff and e.status is not null order by e.happened_at desc,e.event_no desc limit 1),'Pendiente') as closing_status,
      (select e.due_date from public.ticket_events e where e.ticket_id=t.id and e.happened_at<cutoff and e.due_date is not null order by e.happened_at desc,e.event_no desc limit 1) as historical_due
    from public.tickets t where t.project_id=project and t.created_at<cutoff
  ), movements as (
    select e.* from public.ticket_events e where e.project_id=project and e.happened_at>=start_at and e.happened_at<cutoff
  )
  select jsonb_build_object(
    'month',report_month,'generated_at',now(),'cutoff',cutoff,'frozen',false,'is_demo',demo,
    'project_name',(select name from public.projects where id=project),
    'opening',(select count(*) from cases where created_at<start_at and opening_status<>'Cerrada'),
    'created',(select count(*) from cases where created_at>=start_at),
    'closure_events',(select count(*) from movements where action='close'),
    'closed_cases',(select count(distinct ticket_id) from movements where action='close'),
    'reopened',(select count(*) from movements where action='reopen' and (select prev.status from public.ticket_events prev where prev.ticket_id=movements.ticket_id and prev.event_no<movements.event_no and prev.status is not null order by prev.event_no desc limit 1)='Cerrada'),
    'ending',(select count(*) from cases where closing_status<>'Cerrada'),
    'overdue',(select count(*) from cases where closing_status<>'Cerrada' and historical_due<( (cutoff-interval '1 microsecond') at time zone 'America/Bogota')::date),
    'unknown_deadlines',(select count(*) from cases where closing_status<>'Cerrada' and historical_due is null),
    'seeded',(select count(*) from movements where action='demo_seed'),
    'areas',coalesce((select jsonb_agg(x order by x.area) from (
      select area,count(*) filter(where created_at>=start_at) as created,count(*) filter(where closing_status<>'Cerrada') as pending,count(*) filter(where closing_status='Por verificar') as review from cases group by area
    ) x),'[]'::jsonb),
    'priorities',coalesce((select jsonb_agg(x) from (select priority,count(*) as pending from cases where closing_status<>'Cerrada' group by priority) x),'[]'::jsonb),
    'trend',coalesce((select jsonb_agg(x order by x.month) from (
      select to_char(m,'YYYY-MM') as month,
      (select count(*) from public.tickets t where t.project_id=project and t.created_at>=m at time zone 'America/Bogota' and t.created_at<least((m+interval '1 month') at time zone 'America/Bogota',cutoff)) as created,
      (select count(*) from public.ticket_events e where e.project_id=project and e.action='close' and e.happened_at>=m at time zone 'America/Bogota' and e.happened_at<least((m+interval '1 month') at time zone 'America/Bogota',cutoff)) as closures
      from generate_series(report_month::timestamp-interval '5 months',report_month::timestamp,interval '1 month') m
    ) x),'[]'::jsonb)
  ) into result;
  return result;
end;
$$;
revoke all on function public.monthly_report(text,date) from public,anon;
grant execute on function public.monthly_report(text,date) to authenticated;

create function public.finalize_monthly_report(project text, report_month date) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
  if auth.uid() is null or coalesce(public.project_role(project),'') not in ('admin','coordinator') then raise exception 'Solo administración o coordinación puede cerrar un informe.'; end if;
  if report_month is null or report_month>=date_trunc('month',now() at time zone 'America/Bogota')::date then raise exception 'Solo puedes conservar el cierre de un mes terminado.'; end if;
  if (select is_demo from public.projects where id=project) then raise exception 'Los proyectos de demostración no generan cierres oficiales.'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(project||report_month::text,0));
  result := public.monthly_report(project,report_month);
  if (result->>'seeded')::integer>0 then raise exception 'El período contiene casos precargados de demostración.'; end if;
  insert into public.monthly_reports(project_id,month,content,finalized_by) values(project,report_month,result,auth.uid()) on conflict(project_id,month) do nothing;
  return public.monthly_report(project,report_month);
end;
$$;
revoke all on function public.finalize_monthly_report(text,date) from public,anon;
grant execute on function public.finalize_monthly_report(text,date) to authenticated;
commit;
