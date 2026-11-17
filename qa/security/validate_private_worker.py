"""Fail-closed static gate for packaging the private ADPHOR QA Python Worker."""
import json
from pathlib import Path
root = Path(__file__).resolve().parents[2]
qa = json.loads((root / "backend/wrangler.qa.jsonc").read_text())
legacy = json.loads((root / "backend/wrangler.jsonc").read_text())
assert qa["name"] == "adphor-ai-qa"
assert qa["workers_dev"] is False and qa["preview_urls"] is False
assert not qa.get("route") and not qa.get("routes") and not qa.get("triggers")
assert qa["main"] == "src/worker.py" and "python_workers" in qa["compatibility_flags"]
assert qa["vars"] == {
  "SUPABASE_URL": "https://qfctnnnnltghepwujpdm.supabase.co",
  "ALLOWED_ORIGIN": "https://qa-integral-claude-reviewed.adphor-platform.pages.dev",
  "QA_AGENT_READONLY_ENABLED": "false",
  "QA_PRIVATE_SERVICE_ONLY": "true",
}
assert legacy["name"] == "adphor-ai"
assert legacy["vars"]["SUPABASE_URL"] != qa["vars"]["SUPABASE_URL"]
print("PASS: strictly private, disabled QA Python Worker configuration.")
