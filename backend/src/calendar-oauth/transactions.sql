-- Private OAuth transaction schema. Apply only through the QA migration process.
-- Bind this capability only to the dedicated QA backend database login.
-- Browser roles and the general API service accounts receive no grants.
CREATE ROLE adphor_qa_calendar_oauth_state NOLOGIN;
CREATE ROLE adphor_qa_calendar_oauth_login LOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
GRANT adphor_qa_calendar_oauth_state TO adphor_qa_calendar_oauth_login;
CREATE SCHEMA calendar_oauth_private;
REVOKE ALL ON SCHEMA calendar_oauth_private FROM PUBLIC;

CREATE TABLE calendar_oauth_private.transactions (
    state_digest text PRIMARY KEY CHECK (state_digest ~ '^[A-Za-z0-9_-]{43}$'),
    browser_nonce_digest text NOT NULL CHECK (browser_nonce_digest ~ '^[A-Za-z0-9_-]{43}$'),
    access_subject text NOT NULL,
    expires_at bigint NOT NULL,
    payload jsonb NOT NULL
);
ALTER TABLE calendar_oauth_private.transactions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE calendar_oauth_private.transactions FROM PUBLIC;

GRANT USAGE ON SCHEMA calendar_oauth_private TO adphor_qa_calendar_oauth_state;
GRANT SELECT, INSERT, DELETE ON calendar_oauth_private.transactions TO adphor_qa_calendar_oauth_state;

CREATE POLICY oauth_state_select ON calendar_oauth_private.transactions
    FOR SELECT TO adphor_qa_calendar_oauth_state USING (true);
CREATE POLICY oauth_state_insert ON calendar_oauth_private.transactions
    FOR INSERT TO adphor_qa_calendar_oauth_state WITH CHECK (true);
CREATE POLICY oauth_state_delete ON calendar_oauth_private.transactions
    FOR DELETE TO adphor_qa_calendar_oauth_state USING (true);

CREATE TABLE calendar_oauth_private.pending (
    pending_digest text PRIMARY KEY CHECK (pending_digest ~ '^[A-Za-z0-9_-]{43}$'),
    access_subject text NOT NULL,
    user_id text NOT NULL,
    project_id text NOT NULL,
    expires_at timestamptz NOT NULL DEFAULT (CURRENT_TIMESTAMP + interval '3 minutes'),
    payload jsonb NOT NULL
);
ALTER TABLE calendar_oauth_private.pending ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE calendar_oauth_private.pending FROM PUBLIC;

GRANT SELECT, DELETE ON calendar_oauth_private.pending TO adphor_qa_calendar_oauth_state;
GRANT INSERT (pending_digest, access_subject, user_id, project_id, payload)
    ON calendar_oauth_private.pending TO adphor_qa_calendar_oauth_state;

CREATE POLICY oauth_pending_select ON calendar_oauth_private.pending
    FOR SELECT TO adphor_qa_calendar_oauth_state USING (true);
CREATE POLICY oauth_pending_insert ON calendar_oauth_private.pending
    FOR INSERT TO adphor_qa_calendar_oauth_state WITH CHECK (true);
CREATE POLICY oauth_pending_delete ON calendar_oauth_private.pending
    FOR DELETE TO adphor_qa_calendar_oauth_state USING (true);

CREATE TABLE calendar_oauth_private.connections (
    user_id text NOT NULL,
    project_id text NOT NULL,
    google_subject text NOT NULL,
    payload jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, project_id),
    UNIQUE (project_id, google_subject)
);
ALTER TABLE calendar_oauth_private.connections ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE calendar_oauth_private.connections FROM PUBLIC;

GRANT INSERT (user_id, project_id, google_subject, payload)
    ON calendar_oauth_private.connections TO adphor_qa_calendar_oauth_state;

CREATE POLICY oauth_connection_insert ON calendar_oauth_private.connections
    FOR INSERT TO adphor_qa_calendar_oauth_state WITH CHECK (true);
