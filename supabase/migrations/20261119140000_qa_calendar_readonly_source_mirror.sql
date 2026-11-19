-- ADPHOR QA Integral only. Non-destructive read-only source mirror.
-- The schema is intentionally absent from Supabase Data API exposed schemas.
CREATE SCHEMA IF NOT EXISTS qa_calendar_private;
REVOKE ALL ON SCHEMA qa_calendar_private FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS qa_calendar_private.source_events (
  calendar_id text NOT NULL CHECK (char_length(calendar_id) BETWEEN 1 AND 255),
  google_event_id text NOT NULL CHECK (char_length(google_event_id) BETWEEN 1 AND 512),
  summary text NOT NULL CHECK (char_length(summary) BETWEEN 1 AND 500),
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  source_status text NOT NULL CHECK (source_status IN ('confirmed','tentative','cancelled')),
  source_window text NOT NULL,
  import_batch text NOT NULL,
  imported_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  mapped_project_id text NULL REFERENCES public.projects(id) ON DELETE RESTRICT,
  mapping_reviewed boolean NOT NULL DEFAULT false,
  CONSTRAINT calendar_source_events_pk PRIMARY KEY (calendar_id, google_event_id),
  CONSTRAINT calendar_source_valid_interval CHECK (end_at > start_at),
  CONSTRAINT calendar_source_unmapped_not_verified CHECK (NOT mapping_reviewed OR mapped_project_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS source_calendar_events_start_idx ON qa_calendar_private.source_events (start_at);
ALTER TABLE qa_calendar_private.source_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA qa_calendar_private FROM PUBLIC, anon, authenticated, service_role;
COMMENT ON SCHEMA qa_calendar_private IS 'ADPHOR QA Integral private source archive; not exposed via Data API';
COMMENT ON TABLE qa_calendar_private.source_events IS 'Read-only original Google Calendar copy. No attendees, descriptions, credentials or Google writes; tenant mapping needs independent review.';
