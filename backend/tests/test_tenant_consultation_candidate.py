"""Sandbox HTTP tests: NO network, NO SQL, NO real Supabase tokens/data."""
from __future__ import annotations
import unittest
from dataclasses import replace
from fastapi import FastAPI, HTTPException, Request
from fastapi.testclient import TestClient
from backend.src.adphor_ai.tenant_consultation import (
    ConsultationSettings, SyntheticConsultation, build_router,
)

STAGING = ConsultationSettings(
    deployment="staging", mode="synthetic",
    supabase_url="https://adphor-qa-mock.supabase.co",
    staging_project_ref="adphor-qa-mock",
    frontend_origin="https://qa.adphor.invalid",
)

class TenantConsultationTests(unittest.TestCase):
    def setUp(self):
        self.roles = {
            "user-a": {"00000000-0000-0000-0000-000000000001": "viewer"},
            "user-b": {"00000000-0000-0000-0000-000000000002": "technician"},
            "admin-ab": {"00000000-0000-0000-0000-000000000001": "admin", "00000000-0000-0000-0000-000000000002": "admin"},
            "outsider": {},
        }
        self.seen = []
        async def identity(request: Request):
            authorization = request.headers.get("Authorization", "")
            if not authorization.startswith("Bearer test-"):
                raise HTTPException(401, "Debes iniciar sesión.")
            user = authorization[len("Bearer test-"):]
            if user not in self.roles:
                raise HTTPException(401, "Usuario no válido.")
            return {"id":user, "token":authorization.split(" ", 1)[1]}
        async def membership(request, actor, project_id, allowed):
            self.seen.append((actor["id"], project_id, tuple(allowed)))
            if self.roles.get(actor["id"], {}).get(project_id) not in allowed:
                raise HTTPException(403, "No autorizado para la copropiedad.")
        self.identity, self.membership = identity, membership
        self.client = self.make_client(STAGING)

    def make_client(self, settings, store=None):
        app = FastAPI()
        app.include_router(build_router(identity_dependency=self.identity,
                                        membership_checker=self.membership,
                                        settings=settings, store=store))
        return TestClient(app)

    def get(self, who="user-a", project="00000000-0000-0000-0000-000000000001", client=None):
        return (client or self.client).get("/consultation/summary",params={"project_id":project},
                        headers={"Authorization":f"Bearer test-{who}"})

    def test_user_a_only_sees_a(self):
        r=self.get()
        self.assertEqual(r.status_code,200)
        self.assertEqual(r.json(),{"project_id":"00000000-0000-0000-0000-000000000001","source":"synthetic",
            "agent_access":False,"record_count":2,"totals":{"events":2,"pqrs":0,"pending":1}})
        self.assertNotIn("synthetic-b",str(r.json()))

    def test_user_b_only_sees_b(self):
        r=self.get("user-b","00000000-0000-0000-0000-000000000002")
        self.assertEqual(r.status_code,200)
        self.assertEqual(r.json()["totals"],{"events":1,"pqrs":1,"pending":2})
        self.assertNotIn("synthetic-a",str(r.json()))

    def test_cross_a_to_b_denied(self): self.assertEqual(self.get("user-a","00000000-0000-0000-0000-000000000002").status_code,403)
    def test_cross_b_to_a_denied(self): self.assertEqual(self.get("user-b","00000000-0000-0000-0000-000000000001").status_code,403)
    def test_outsider_denied(self): self.assertEqual(self.get("outsider","00000000-0000-0000-0000-000000000001").status_code,403)
    def test_admin_can_view_each_separately(self):
        self.assertEqual(self.get("admin-ab","00000000-0000-0000-0000-000000000001").json()["record_count"],2)
        self.assertEqual(self.get("admin-ab","00000000-0000-0000-0000-000000000002").json()["record_count"],2)

    def test_membership_revocation_immediate(self):
        self.assertEqual(self.get().status_code,200)
        self.roles["user-a"].clear()
        self.assertEqual(self.get().status_code,403)

    def test_missing_session_denied(self):
        r=self.client.get("/consultation/summary",params={"project_id":"00000000-0000-0000-0000-000000000001"})
        self.assertEqual(r.status_code,401)

    def test_unknown_actor_denied(self): self.assertEqual(self.get("unregistered","00000000-0000-0000-0000-000000000001").status_code,401)
    def test_malformed_tenant_denied(self): self.assertEqual(self.get("user-a","00000000-0000-0000-0000-000000000001 OR 1=1").status_code,422)
    def test_missing_tenant_denied(self):
        self.assertEqual(self.client.get("/consultation/summary", headers={"Authorization":"Bearer test-user-a"}).status_code,422)

    def test_default_disabled(self):
        self.assertEqual(self.get(client=self.make_client(ConsultationSettings())).status_code,503)
        self.assertEqual(self.seen,[])

    def test_production_cannot_enable_synthetic_flag(self):
        prod=replace(STAGING,deployment="production")
        self.assertEqual(self.get(client=self.make_client(prod)).status_code,503)

    def test_production_project_ref_denied(self):
        prod=replace(STAGING,staging_project_ref="oqizvirqjwbbhyyjpthq",
                     supabase_url="https://oqizvirqjwbbhyyjpthq.supabase.co")
        self.assertEqual(self.get(client=self.make_client(prod)).status_code,503)

    def test_production_origin_denied(self):
        prod=replace(STAGING,frontend_origin="https://adphor-platform.pages.dev")
        self.assertEqual(self.get(client=self.make_client(prod)).status_code,503)

    def test_wrong_database_ref_denied(self):
        prod=replace(STAGING,supabase_url="https://other-qa.supabase.co")
        self.assertEqual(self.get(client=self.make_client(prod)).status_code,503)

    def test_no_data_changes_allowed(self):
        r=self.client.post("/consultation/summary",params={"project_id":"00000000-0000-0000-0000-000000000001"},headers={"Authorization":"Bearer test-user-a"})
        self.assertEqual(r.status_code,405)

    def test_response_never_exposes_rows_or_tokens(self):
        self.assertEqual(set(self.get().json()), {"project_id","source","agent_access","record_count","totals"})

    def test_bad_fixture_rejected(self):
        with self.assertRaises(ValueError): SyntheticConsultation([{"project_id":"bad/path"}])

    def test_unexpected_fixture_category_fail_closed(self):
        store=SyntheticConsultation([{"project_id":"00000000-0000-0000-0000-000000000001","category":"untrusted","status":"Pendiente"}])
        self.assertEqual(self.get(client=self.make_client(STAGING,store)).status_code,503)

if __name__=="__main__":unittest.main()
