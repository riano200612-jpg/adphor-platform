#!/usr/bin/env bash
# Run from the repository root on the approved QA host. Inject secrets before starting.
# Bind privately; route only through the existing protected QA ingress.
set +x
set -eu

if [[ "${SUPABASE_URL:-}" != 'https://qfctnnnnltghepwujpdm.supabase.co' ||
      "${FRONTEND_ORIGIN:-}" != 'https://qa-pqrs-carrusel-integracion.adphor-platform.pages.dev' ]]; then
  printf '%s\n' 'Invalid ADPHOR QA project or frontend origin.' >&2
  exit 1
fi

missing=0
for name in SUPABASE_PUBLISHABLE_KEY ADPHOR_QA_CALENDAR_ID \
  ADPHOR_QA_CALENDAR_OAUTH_CLIENT_ID ADPHOR_QA_CALENDAR_OAUTH_CLIENT_SECRET \
  ADPHOR_QA_CALENDAR_OAUTH_REFRESH_TOKEN; do
  if [[ -z "${!name:-}" ]]; then
    printf 'Missing QA configuration: %s\n' "$name" >&2
    missing=1
  fi
done
if (( missing )); then exit 1; fi
if [[ "$SUPABASE_PUBLISHABLE_KEY" == sb_secret_* ]]; then
  printf '%s\n' 'Use the QA publishable key.' >&2
  exit 1
fi

export ADPHOR_DEPLOYMENT=staging ADPHOR_CONSULTATION_MODE=synthetic
export ADPHOR_STAGING_PROJECT_REF=qfctnnnnltghepwujpdm
# This availability process does not need the optional privileged agent writer.
export SUPABASE_AGENT_WRITER_KEY=
exec python -m uvicorn backend.local_api:app --host 127.0.0.1 --port 8000
