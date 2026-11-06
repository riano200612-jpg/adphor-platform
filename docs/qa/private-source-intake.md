# Private source intake — QA only

The source planner accepts only the isolated QA project. It writes no database
records and never approves a property mapping, creates an Auth user, assigns
memberships, creates Calendar events or promotes historical cases to live PQRS.
No source archive, SQL containing actual records or private review file belongs
in Git. Output paths inside a Git checkout are rejected; use a private temporary
directory outside Git. SQL literals are escaped and each row has a deterministic
batch/source-row identity. Replays of the same archive do not duplicate records.

Run from the repository with an authorized private archive:

```sh
python3 scripts/qa_source_intake.py --archive /private/source.zip \
  --project-ref qfctnnnnltghepwujpdm
```

Optional `--sql-output /private/import.sql` and `--review-output /private/review.json`
create private files with mode 0600. These outputs contain personal source data;
do not attach them to public issues, Actions artifacts or PRs. Execute generated
SQL only using a server-side admin connection independently verified to point at
QA. No service credentials belong in this tool or in frontend variables.

The reviewed source contains PQRS without an explicit property field. A
delegate-to-property match is a suggestion, not proof of case ownership.
Each administrator must access only their authorized property through their
own user and membership. Directory roles never create application permissions.

## Applied QA schema contract

Remote migration name: `qa_private_directory_source_intake`. This contract is
documented here for review; applying to production is not authorized.

```sql
CREATE TABLE IF NOT EXISTS pilot_private.directory_sources (batch_id uuid NOT NULL, source_kind text NOT NULL CHECK(source_kind IN ('delegates','projects')), source_row integer NOT NULL CHECK(source_row>=2), source_key text NOT NULL, payload_sha256 text NOT NULL CHECK(payload_sha256 ~ '^[a-f0-9]{64}$'), payload jsonb NOT NULL CHECK(jsonb_typeof(payload)='object') CHECK(NOT (payload ?| ARRAY['PIN','OTP','password','password_hash','Intentos Fallidos','Estado Bloqueado OTP'])), imported_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(batch_id,source_kind,source_row)); ALTER TABLE pilot_private.directory_sources ENABLE ROW LEVEL SECURITY; REVOKE ALL ON pilot_private.directory_sources FROM PUBLIC,anon,authenticated; COMMENT ON TABLE pilot_private.directory_sources IS 'QA private historical source intake. Does not grant application roles, create Auth accounts or establish approved project mappings.';
```

The existing `pilot_private.pqrs_sources` schema is reused for source cases.
Both intake tables deny access to `anon` and `authenticated`; they are not app
screens. Private source rows are not yet operational PQRS or staff cards.

## Verification

```sh
python3 -m unittest discover -s tests -p test_qa_source_intake.py -v
```

The intake performed on 2026-11-06 retained 29 source PQRS, 55 delegate entries
and 44 source project entries in QA. Replaying the batch kept these totals
unchanged. No project mappings were approved and no operational cases were
created by this intake. Private schemas/grants and existing MFA gates were
retained. SQL claim simulations are not a hosted two-user authentication test.
