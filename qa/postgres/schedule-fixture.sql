-- Fixture autónomo QA. No conecta a Supabase.
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE SCHEMA porto_qa;
CREATE TABLE porto_qa.meetings (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  project_id text NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'scheduled',
  requires_management boolean NOT NULL DEFAULT false,
  CHECK(ends_at > starts_at),
  CONSTRAINT management_no_overlap EXCLUDE USING gist (
    project_id WITH =,
    tstzrange(starts_at - interval '15 minutes', ends_at + interval '15 minutes','[)') WITH &&
  ) WHERE (status='scheduled' AND requires_management)
);
INSERT INTO porto_qa.meetings(project_id,starts_at,ends_at,requires_management)
VALUES ('porto-castello','2026-11-03 10:00+00','2026-11-03 11:00+00',true);
DO $$
BEGIN
  BEGIN
    INSERT INTO porto_qa.meetings(project_id,starts_at,ends_at,requires_management)
    VALUES ('porto-castello','2026-11-03 11:10+00','2026-11-03 12:00+00',true);
    RAISE EXCEPTION 'FAILED: overlap accepted';
  EXCEPTION WHEN exclusion_violation THEN NULL;
  END;
END $$;
INSERT INTO porto_qa.meetings(project_id,starts_at,ends_at,requires_management)
VALUES ('porto-castello','2026-11-03 11:31+00','2026-11-03 12:00+00',true),
       ('other-property','2026-11-03 10:30+00','2026-11-03 11:30+00',true);
DO $$
BEGIN
  IF (SELECT count(*) FROM porto_qa.meetings) <> 3 THEN
    RAISE EXCEPTION 'FAILED: expected three permitted records';
  END IF;
END $$;
