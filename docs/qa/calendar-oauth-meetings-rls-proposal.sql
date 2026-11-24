-- PROPOSAL ONLY: do not apply until owner approval and QA migration review.
-- Extends the existing private OAuth schema for the single pilot. No public/browser grants.
GRANT SELECT (user_id, project_id, google_subject, payload)
  ON calendar_oauth_private.connections TO adphor_qa_calendar_oauth_state;
CREATE POLICY oauth_connection_scoped_select ON calendar_oauth_private.connections
  FOR SELECT TO adphor_qa_calendar_oauth_state
  USING (user_id = nullif(current_setting('adphor.calendar_user_id', true),'')
     AND project_id = nullif(current_setting('adphor.calendar_project_id', true),''));

CREATE TABLE calendar_oauth_private.meetings (
  user_id text NOT NULL,
  project_id text NOT NULL,
  idempotency_key text NOT NULL CHECK (idempotency_key ~ '^[a-z0-9_-]{20,128}$'),
  google_event_id text,
  meet_url text,
  status text NOT NULL CHECK (status IN ('creating','created','meet_pending','failed')),
  summary text,
  start_at timestamptz,
  end_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, project_id, idempotency_key),
  UNIQUE (project_id, google_event_id),
  CHECK (meet_url IS NULL OR meet_url ~ '^https://meet[.]google[.]com/[a-z0-9-]+$'),
  CHECK (start_at IS NULL OR end_at IS NULL OR end_at > start_at)
);
ALTER TABLE calendar_oauth_private.meetings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON calendar_oauth_private.meetings FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE ON calendar_oauth_private.meetings TO adphor_qa_calendar_oauth_state;
CREATE POLICY oauth_meetings_select ON calendar_oauth_private.meetings
  FOR SELECT TO adphor_qa_calendar_oauth_state
  USING (user_id = nullif(current_setting('adphor.calendar_user_id', true),'')
     AND project_id = nullif(current_setting('adphor.calendar_project_id', true),''));
CREATE POLICY oauth_meetings_insert ON calendar_oauth_private.meetings
  FOR INSERT TO adphor_qa_calendar_oauth_state
  WITH CHECK (user_id = nullif(current_setting('adphor.calendar_user_id', true),'')
          AND project_id = nullif(current_setting('adphor.calendar_project_id', true),''));
CREATE POLICY oauth_meetings_update ON calendar_oauth_private.meetings
  FOR UPDATE TO adphor_qa_calendar_oauth_state
  USING (user_id = nullif(current_setting('adphor.calendar_user_id', true),'')
     AND project_id = nullif(current_setting('adphor.calendar_project_id', true),''))
  WITH CHECK (user_id = nullif(current_setting('adphor.calendar_user_id', true),'')
          AND project_id = nullif(current_setting('adphor.calendar_project_id', true),''));
