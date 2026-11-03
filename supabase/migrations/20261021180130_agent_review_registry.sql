-- Immutable, completed analysis snapshots. A changed draft is a new run;
-- approval of an older snapshot never approves the new one.
create table public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  project_id text not null references public.projects(id),
  created_at timestamptz not null default now(),
  source_read_at timestamptz not null,
  engine_kind text not null check (engine_kind in ('rules', 'models')),
  source_snapshot jsonb not null check (jsonb_typeof(source_snapshot) = 'object'),
  findings jsonb not null check (jsonb_typeof(findings) = 'array'),
  steps jsonb not null check (jsonb_typeof(steps) = 'array' and jsonb_array_length(steps) = 3),
  draft text not null check (length(btrim(draft)) between 1 and 20000),
  result_hash text not null check (result_hash ~ '^[0-9a-f]{64}$'),
  unique (id, project_id, result_hash)
);
create index agent_runs_project_created_idx on public.agent_runs(project_id, created_at desc, id);

create table public.agent_reviews (
  run_id uuid primary key,
  project_id text not null,
  result_hash text not null,
  decision text not null check (decision in ('approved', 'rejected')),
  administrator_id uuid not null default auth.uid(),
  decided_at timestamptz not null default now(),
  note text not null default '' check (length(note) <= 4000),
  foreign key (run_id, project_id, result_hash)
    references public.agent_runs(id, project_id, result_hash)
);
create index agent_reviews_project_idx on public.agent_reviews(project_id, decided_at desc);

alter table public.agent_runs enable row level security;
alter table public.agent_reviews enable row level security;
create policy agent_runs_read on public.agent_runs for select to authenticated
  using (public.project_role(project_id) in ('admin', 'coordinator'));
create policy agent_reviews_read on public.agent_reviews for select to authenticated
  using (public.project_role(project_id) in ('admin', 'coordinator'));
create policy agent_reviews_admin_insert on public.agent_reviews for insert to authenticated
  with check (administrator_id = (select auth.uid()) and public.project_role(project_id) = 'admin');

-- No direct client writes to generated results, no updates/deletes, and no
-- worker/service-role approval privilege. Author and timestamp are server defaults.
revoke all on public.agent_runs, public.agent_reviews from public, anon, authenticated, service_role;
grant select on public.agent_runs, public.agent_reviews to authenticated;
grant select on public.agent_runs to service_role;
grant insert (id, project_id, source_read_at, engine_kind, source_snapshot, findings, steps, draft, result_hash)
  on public.agent_runs to service_role;
grant insert (run_id, project_id, result_hash, decision, note)
  on public.agent_reviews to authenticated;

create view public.agent_run_status with (security_invoker = true) as
select r.id, r.project_id, r.created_at, r.source_read_at, r.engine_kind,
       r.draft, r.result_hash,
       case v.decision
         when 'approved' then 'Aprobado por el administrador'
         when 'rejected' then 'Rechazado por el administrador'
         else 'Pendiente de aprobación del administrador'
       end as status,
       v.administrator_id, v.decided_at, v.note
from public.agent_runs r left join public.agent_reviews v on v.run_id = r.id;
revoke all on public.agent_run_status from public, anon, authenticated, service_role;
grant select on public.agent_run_status to authenticated;
comment on table public.agent_runs is 'Completed immutable snapshots only; unfinished/failed stages must not be inserted. Models are not activated by this migration.';
comment on table public.agent_reviews is 'Explicit human decision on an exact immutable snapshot; no case closure or report dispatch.';
