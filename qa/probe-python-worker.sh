#!/usr/bin/env bash
# Run from the repository root. Local test only; never deploys.
set -eu
case "${1:-dry-run}" in dry-run|local) ;; *) exit 2;; esac
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
mkdir -p "$work/probe/backend"
cp backend/local_api.py "$work/probe/backend/"
cp -r backend/src "$work/probe/backend/"
cp backend/pyproject.toml backend/uv.lock "$work/"
cd "$work"
python3 - <<'PY'
from pathlib import Path
p = Path('pyproject.toml')
p.write_text(p.read_text().replace('dependencies = []',
    'dependencies = ["fastapi==0.159.1", "httpx==0.28.1", "python-dotenv==1.2.4"]'))
PY
cat > probe/main.py <<'PY'
from workers import asgi
from backend.local_api import app

Default = asgi.entrypoint(app)
PY
cat > wrangler.jsonc <<'JSON'
{"name":"adphor-qa-compatibility-local","main":"probe/main.py","compatibility_date":"2026-10-21","compatibility_flags":["python_workers"],"workers_dev":false,"vars":{"SUPABASE_URL":"https://qfctnnnnltghepwujpdm.supabase.co","SUPABASE_PUBLISHABLE_KEY":"sb_publishable_compatibility_probe_only","FRONTEND_ORIGIN":"https://qa-pqrs-carrusel-integracion.adphor-platform.pages.dev"}}
JSON
if [[ "${1:-dry-run}" == local ]]; then
  uv run pywrangler dev --local --port 8791
else
  uv run pywrangler deploy --dry-run --outdir bundle
fi
