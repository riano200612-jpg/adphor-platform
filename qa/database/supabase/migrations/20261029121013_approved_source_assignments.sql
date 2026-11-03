-- QA ONLY. Standalone synthetic contract; not a production migration.
-- No grants to ordinary agents. Application roles have read-only tenant access.
BEGIN;
CREATE SCHEMA adphor_qa;
REVOKE ALL ON SCHEMA adphor_qa FROM PUBLIC;
CREATE TABLE adphor_qa.projects (id uuid PRIMARY KEY);
CREATE TABLE adphor_qa.memberships (
 project_id uuid REFERENCES adphor_qa.projects(id), user_id uuid NOT NULL,
 PRIMARY KEY(project_id,user_id)
);
CREATE TABLE adphor_qa.source_rows (
 batch_id uuid NOT NULL, source_row integer CHECK(source_row>=2),
 source_kind text NOT NULL CHECK(source_kind IN ('event','pqrs')),
 PRIMARY KEY(batch_id,source_row), UNIQUE(batch_id,source_row,source_kind)
);
CREATE TABLE adphor_qa.assignments (
 batch_id uuid, source_row integer, project_id uuid NOT NULL REFERENCES adphor_qa.projects,
 source_kind text NOT NULL, approved_by uuid NOT NULL, approved_at timestamptz NOT NULL,
 evidence text NOT NULL CHECK(length(trim(evidence))>0),
 PRIMARY KEY(batch_id,source_row), UNIQUE(batch_id,source_row,project_id,source_kind),
 FOREIGN KEY(batch_id,source_row,source_kind) REFERENCES adphor_qa.source_rows(batch_id,source_row,source_kind)
);
CREATE TABLE adphor_qa.activities (
 id uuid PRIMARY KEY, batch_id uuid NOT NULL, source_row integer NOT NULL,
 project_id uuid NOT NULL, source_kind text NOT NULL CHECK(source_kind IN ('event','pqrs')),
 occurred_at timestamptz NOT NULL, category text NOT NULL CHECK(length(trim(category))>0),
 UNIQUE(batch_id,source_row),
 FOREIGN KEY(batch_id,source_row,project_id,source_kind)
 REFERENCES adphor_qa.assignments(batch_id,source_row,project_id,source_kind)
);
CREATE INDEX activities_project_date ON adphor_qa.activities(project_id,occurred_at);
CREATE INDEX activities_project_category ON adphor_qa.activities(project_id,category);
ALTER TABLE adphor_qa.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE adphor_qa.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE adphor_qa.source_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE adphor_qa.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE adphor_qa.activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_membership ON adphor_qa.memberships FOR SELECT TO authenticated
 USING(user_id=auth.uid());
CREATE POLICY tenant_activities ON adphor_qa.activities FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM adphor_qa.memberships m WHERE m.project_id=activities.project_id AND m.user_id=auth.uid()));
GRANT USAGE ON SCHEMA adphor_qa TO authenticated;
GRANT SELECT ON adphor_qa.memberships,adphor_qa.activities TO authenticated;
-- Deliberately no INSERT/UPDATE/DELETE grants or policies, no agent gate open.
COMMIT;
