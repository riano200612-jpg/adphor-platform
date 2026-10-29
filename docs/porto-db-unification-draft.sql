-- BORRADOR DE MIGRACION: NO EJECUTAR SIN AUDITORIA DE SCHEMA / ROLES.
-- adphor_db es denominación lógica; el proyecto Supabase existente sigue siendo
-- una base PostgreSQL con esquema public para tablas heredadas. No renombrar
-- la base ni mover tablas en producción por esta propuesta.
begin;
create schema if not exists adphor_db;
create table if not exists adphor_db.meetings (
 id uuid primary key default gen_random_uuid(),
 project_id bigint not null, -- AJUSTAR al tipo real de public.projects.id
 title text not null,
 agenda text,
 starts_at timestamptz not null,
 ends_at timestamptz not null,
 status text not null default 'pending' check(status in ('pending','scheduled','cancelled','completed')),
 priority_level text not null default 'bajo' check(priority_level in ('alto','medio','bajo')),
 requires_management boolean not null default false,
 management_presence_status text not null default 'not_required',
 ai_conflict_checked boolean not null default false,
 exception_status text not null default 'none' check(exception_status in ('none','pending','approved','rejected')),
 approved_by uuid,
 approved_at timestamptz,
 created_by uuid,
 created_at timestamptz not null default now(),
 check(ends_at > starts_at)
);
create table if not exists adphor_db.meeting_attendees (
 meeting_id uuid not null references adphor_db.meetings(id) on delete cascade,
 user_id uuid not null,
 status text not null default 'pending',
 responded_at timestamptz,
 primary key(meeting_id,user_id)
);
create table if not exists adphor_db.meeting_exception_requests (
 id uuid primary key default gen_random_uuid(),
 meeting_id uuid references adphor_db.meetings(id),
 project_id bigint not null,
 requested_by uuid not null,
 reason text not null,
 proposed_start timestamptz not null,
 proposed_end timestamptz not null,
 status text not null default 'pending' check(status in ('pending','approved','rejected')),
 decided_by uuid,
 decided_at timestamptz,
 created_at timestamptz not null default now(),
 check(proposed_end > proposed_start)
);
create table if not exists adphor_db.media_assets (
 id uuid primary key default gen_random_uuid(),
 project_id bigint not null,
 ticket_id text,
 meeting_id uuid references adphor_db.meetings(id),
 storage_path text not null unique,
 mime_type text not null,
 bytes bigint not null check(bytes > 0),
 sha256 text,
 scan_status text not null default 'pending',
 created_by uuid,
 created_at timestamptz not null default now()
);
create table if not exists adphor_db.ai_events (
 id uuid primary key default gen_random_uuid(),
 project_id bigint not null,
 event_type text not null,
 source_id text not null,
 payload jsonb not null default '{}'::jsonb,
 processed_at timestamptz,
 retry_count integer not null default 0,
 created_at timestamptz not null default now(),
 unique(project_id,event_type,source_id)
);
create table if not exists adphor_db.knowledge_documents (
 id uuid primary key default gen_random_uuid(),
 project_id bigint not null,
 source_type text not null,
 source_id text not null,
 content_hash text not null,
 extraction_version text not null,
 index_status text not null default 'pending',
 created_at timestamptz not null default now(),
 unique(project_id,source_type,source_id,content_hash)
);
-- En schema no expuesto: sin privilegios cliente por defecto.
revoke all on schema adphor_db from public, anon, authenticated;
revoke all on all tables in schema adphor_db from public, anon, authenticated;
alter table adphor_db.meetings enable row level security;
alter table adphor_db.meeting_attendees enable row level security;
alter table adphor_db.meeting_exception_requests enable row level security;
alter table adphor_db.media_assets enable row level security;
alter table adphor_db.ai_events enable row level security;
alter table adphor_db.knowledge_documents enable row level security;
-- Faltan: FK reales tenant, RLS por memberships y funciones autorizadas;
-- rango EXCLUDE para gerencia, triggers T-24, outbox y scheduler.
-- La aplicación de este DDL NO constituye migración terminada.
rollback;
