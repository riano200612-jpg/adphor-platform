-- ADPHOR QA Integral: add-only staging for an independently CLONED spreadsheet.
-- Never read/write José's live original; never grant tenants direct table access.
-- The rows below are NOT operational, NOT IAM, NOT AI-indexed and NOT training.
BEGIN;
DO $preflight$ BEGIN
 IF to_regclass('pilot_private.directory_sources') IS NULL
    OR to_regclass('qa_identity_private.legacy_user_candidates') IS NULL
    OR to_regclass('qa_calendar_private.source_events') IS NULL
 THEN RAISE EXCEPTION 'ADPHOR QA Integral markers missing; refuse cloned source staging'; END IF;
END $preflight$;

CREATE FUNCTION pilot_private.qa_clone_allowlisted_payload(kind text, data jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = ''
AS $f$
 SELECT pg_catalog.jsonb_typeof(data) = 'object'
 AND NOT EXISTS (
   SELECT 1 FROM pg_catalog.jsonb_object_keys(data) AS entry(key)
   WHERE NOT (entry.key = ANY(
      CASE kind
       WHEN 'projects' THEN ARRAY['id','name','delegate_id','coordinator_id','sector','operational_email']
       WHEN 'delegates' THEN ARRAY['id','name','username','role','status','historical_contact','sector']
       WHEN 'pqrs' THEN ARRAY['id','registered_at','delegate_id','status','manual_priority','ai_priority']
       WHEN 'property_info' THEN ARRAY['id','name','delegate_id','construction_year','units_total','council_frequency','builder']
       ELSE ARRAY[]::text[]
      END
   ))
 );
$f$;
REVOKE ALL ON FUNCTION pilot_private.qa_clone_allowlisted_payload(text,jsonb)
 FROM PUBLIC,anon,authenticated,service_role;

CREATE TABLE pilot_private.qa_cloned_source_batches(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 source_copy_id text NOT NULL CHECK (length(source_copy_id) BETWEEN 20 AND 128),
 source_title text NOT NULL CHECK (length(source_title) BETWEEN 5 AND 160),
 source_sheet text NOT NULL CHECK (source_sheet IN
  ('Copropiedades','Delegados','PQRS','Info Copropiedades')),
 source_kind text NOT NULL CHECK (source_kind IN
  ('projects','delegates','pqrs','property_info')),
 snapshot_cut text NOT NULL CHECK (length(snapshot_cut) BETWEEN 6 AND 80),
 expected_rows integer NOT NULL CHECK (expected_rows BETWEEN 0 AND 100000),
 classification text NOT NULL CHECK (classification IN ('internal','restricted')),
 state text NOT NULL DEFAULT 'QUARANTINED' CHECK (state='QUARANTINED'),
 indexed boolean NOT NULL DEFAULT false CHECK (indexed=false),
 training_enabled boolean NOT NULL DEFAULT false CHECK (training_enabled=false),
 invitations_sent boolean NOT NULL DEFAULT false CHECK (invitations_sent=false),
 captured_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(source_copy_id,source_sheet,snapshot_cut),
 CONSTRAINT qa_clone_source_sheet_kind CHECK(
  (source_sheet='Copropiedades' AND source_kind='projects') OR
  (source_sheet='Delegados' AND source_kind='delegates') OR
  (source_sheet='PQRS' AND source_kind='pqrs') OR
  (source_sheet='Info Copropiedades' AND source_kind='property_info')
 )
);
CREATE TABLE pilot_private.qa_cloned_source_records(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 batch_id uuid NOT NULL REFERENCES pilot_private.qa_cloned_source_batches(id) ON DELETE RESTRICT,
 source_row integer NOT NULL CHECK (source_row BETWEEN 2 AND 100000),
 source_key text NOT NULL CHECK (length(source_key) BETWEEN 1 AND 160),
 source_kind text NOT NULL CHECK (source_kind IN
  ('projects','delegates','pqrs','property_info')),
 safe_payload jsonb NOT NULL,
 payload_sha256 text NOT NULL CHECK (payload_sha256 ~ '^[0-9a-f]{64}$'),
 review_state text NOT NULL DEFAULT 'QUARANTINED' CHECK (review_state='QUARANTINED'),
 indexed boolean NOT NULL DEFAULT false CHECK (indexed=false),
 training_enabled boolean NOT NULL DEFAULT false CHECK (training_enabled=false),
 source_not_operational boolean NOT NULL DEFAULT true CHECK (source_not_operational=true),
 staged_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(batch_id,source_key),
 CHECK(pg_catalog.octet_length(safe_payload::text) <= 8000),
 CHECK(pilot_private.qa_clone_allowlisted_payload(source_kind,safe_payload))
);
CREATE INDEX qa_clone_record_batch_idx ON pilot_private.qa_cloned_source_records(batch_id,source_kind);

ALTER TABLE pilot_private.qa_cloned_source_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE pilot_private.qa_cloned_source_records ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON pilot_private.qa_cloned_source_batches FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON pilot_private.qa_cloned_source_records FROM PUBLIC,anon,authenticated,service_role;
COMMENT ON TABLE pilot_private.qa_cloned_source_batches IS
 'Cloned Master_ADPHOR reference snapshots. Quarantined and not accessible from browser or AI; originals immutable.';
COMMENT ON TABLE pilot_private.qa_cloned_source_records IS
 'Allowlisted reference fields only. No PIN/password/OTP/raw PQRS/attachments; not operational; no agent indexing/training.';

COMMIT;
