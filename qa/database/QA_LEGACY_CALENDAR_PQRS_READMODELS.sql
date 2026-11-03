-- ADPHOR QA ONLY. DO NOT APPLY TO PRODUCTION oqizvirqjwbbhyyjpthq.
-- Apply to an isolated QA Supabase project AFTER verifying RLS and backups.
-- No data or credentials are embedded in this migration.
create table if not exists public.qa_meeting_events (
 id uuid primary key default gen_random_uuid(),
 project_id text not null references public.projects(id),
 source_batch text not null,
 source_row integer not null check (source_row >= 2),
 source_id text not null,
 source_sha256 text not null check (source_sha256 ~ '^[a-f0-9]{64}$'),
 title text not null,
 kind text not null,
 modality text,
 source_status text not null check (source_status in ('Confirmada','Por Confirmar','Rechazada','Eliminada')),
 start_at timestamptz not null,
 end_at timestamptz not null check (end_at > start_at),
 is_calendar_verified boolean not null default false,
 created_at timestamptz not null default now(),
 unique (source_batch, source_row)
);
create index if not exists qa_meeting_events_scope_start on public.qa_meeting_events(project_id,start_at);
alter table public.qa_meeting_events enable row level security;
-- This table is a historical read model. No client write policy is defined.
revoke all on public.qa_meeting_events from anon, authenticated;
grant select on public.qa_meeting_events to authenticated;
drop policy if exists qa_meeting_member_read on public.qa_meeting_events;
create policy qa_meeting_member_read on public.qa_meeting_events
  for select to authenticated
  using (
    exists (
      select 1 from public.memberships m
      where m.project_id = qa_meeting_events.project_id
        and m.user_id = (select auth.uid())
    )
  );

create table if not exists public.qa_pqrs_history (
 id uuid primary key default gen_random_uuid(),
 project_id text not null references public.projects(id),
 source_batch text not null,
 source_row integer not null check (source_row >= 2),
 source_id text not null,
 source_sha256 text not null check (source_sha256 ~ '^[a-f0-9]{64}$'),
 subject text not null,
 source_status text not null,
 source_created_at timestamptz,
 -- No personal contact, source PIN, credentials or attachment URLs here.
 created_at timestamptz not null default now(),
 unique(source_batch,source_row)
);
create index if not exists qa_pqrs_history_project on public.qa_pqrs_history(project_id,source_created_at);
alter table public.qa_pqrs_history enable row level security;
revoke all on public.qa_pqrs_history from anon, authenticated;
grant select on public.qa_pqrs_history to authenticated;
drop policy if exists qa_pqrs_member_read on public.qa_pqrs_history;
create policy qa_pqrs_member_read on public.qa_pqrs_history
  for select to authenticated
  using (
    exists (
      select 1 from public.memberships m
      where m.project_id = qa_pqrs_history.project_id
        and m.user_id = (select auth.uid())
    )
  );
-- Source rows without approved project mapping MUST remain in private quarantine.
-- Do not create calendar events, notifications or user accounts from imported history.
