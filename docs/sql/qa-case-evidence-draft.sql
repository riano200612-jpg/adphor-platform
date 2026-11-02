-- ADPHOR QA ONLY. Apply manually to a verified isolated database after security review.
-- This DDL is a proposal: committing it does not migrate any data.
begin;
create table if not exists public.qa_case_evidence (
  id uuid primary key default gen_random_uuid(),
  project_id text not null references public.projects(id),
  case_id text not null,
  case_kind text not null check (case_kind in ('pqrs','recorridos')),
  storage_bucket text not null,
  storage_path text not null,
  media_type text not null check (media_type in ('image/jpeg','image/png','image/webp','video/mp4','video/webm','application/pdf')),
  file_bytes bigint not null check (file_bytes > 0 and file_bytes <= 20971520),
  uploaded_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique(storage_bucket, storage_path)
);
create index if not exists qa_case_evidence_project_case on public.qa_case_evidence(project_id,case_kind,case_id);
alter table public.qa_case_evidence enable row level security;
revoke all on public.qa_case_evidence from anon, authenticated;
-- Explicit grants and policies MUST be reviewed against isolated-QA memberships and
-- actual case ownership before enabling inserts/reads. This draft is deliberately locked.
rollback;
