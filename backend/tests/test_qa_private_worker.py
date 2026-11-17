"""Offline private-worker request policy tests, without invoking a Worker runtime."""
import importlib.util
import json
import sys
import types
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

class StubResponse:
    def __init__(self, body, status=200, headers=None):
        self.body = body
        self.status = status
        self.headers = headers or {}

async def no_fetch(*args, **kwargs):
    raise AssertionError("No network calls permitted in private QA routing tests")

class WorkerPrivateQATests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        stub = types.ModuleType("workers")
        stub.WorkerEntrypoint = object
        stub.Response = StubResponse
        stub.fetch = no_fetch
        path = Path(__file__).resolve().parents[1] / "src/worker.py"
        spec = importlib.util.spec_from_file_location("adphor_private_worker_test_module", path)
        with patch.dict(sys.modules, {"workers": stub}):
            mod = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(mod)
        self.worker = mod.Default()
        self.worker.env = SimpleNamespace(
            ALLOWED_ORIGIN="https://qa-integral-claude-reviewed.adphor-platform.pages.dev",
            QA_PRIVATE_SERVICE_ONLY="true",
            QA_AGENT_READONLY_ENABLED="false",
            SUPABASE_URL="https://qfctnnnnltghepwujpdm.supabase.co",
            SUPABASE_PUBLISHABLE_KEY="sb_publishable_synthetic",
        )

    async def request(self, path, method="GET",
                      origin="https://qa-integral-claude-reviewed.adphor-platform.pages.dev"):
        req = SimpleNamespace(method=method,url="https://agent-readonly.internal"+path,
             headers={"Origin":origin, "Authorization":"Bearer synthetic"})
        return await self.worker.fetch(req)

    async def test_legacy_session_endpoint_is_not_exposed(self):
        response=await self.request("/v1/session?project_id=demo-01")
        self.assertEqual(response.status,404)

    async def test_private_origin_is_always_required(self):
        for origin in ("", "https://evil.example", "https://adphor-platform.pages.dev"):
            r=await self.request("/agent-readiness?project_id=demo-01",origin=origin)
            self.assertEqual(r.status,403)
            self.assertNotIn("Access-Control-Allow-Origin",r.headers)

    async def test_readonly_endpoints_disabled_and_no_cors(self):
        r=await self.request("/agent-readiness?project_id=demo-01")
        self.assertEqual(r.status,503)
        self.assertNotIn("Access-Control-Allow-Origin",r.headers)

    async def test_all_mutating_methods_and_options_rejected(self):
        for method in ("OPTIONS","POST","PUT","PATCH","DELETE"):
            r=await self.request("/agent-runs",method=method)
            self.assertEqual(r.status,405)
        health=await self.request("/health")
        self.assertEqual(health.status,200)
        self.assertFalse(json.loads(health.body)["models_ready"])
        self.assertFalse(json.loads(health.body)["rules_ready"])

if __name__ == "__main__":
    unittest.main()
