"""Provider triage adversarial QA tests: synthetic entries, zero network or writes."""
import unittest
from datetime import datetime, timezone
from uuid import uuid4
from adphor_ai.provider_triage import (
    ProviderTriageError, draft_provider_review, stage_feedback_for_human_curation
)

PROJECT = "qa-property-1"
INCIDENT = str(uuid4())
REVIEWER = str(uuid4())
NOW = datetime(2026, 11, 18, 15, 0, tzinfo=timezone.utc)

def supplier(name="Proveedor sintético", **overrides):
    data = {
        "id": str(uuid4()), "project_id": PROJECT, "display_name": name,
        "specialties": ["elevator"], "status": "approved",
        "verified_at": "2026-10-01T00:00:00Z",
        "valid_until": "2027-01-01T00:00:00Z",
        "contact": "PRIVATE-SYNTHETIC-CONTACT",
    }
    data.update(overrides)
    return data

def triage(**changes):
    args = {
        "incident": {"id": INCIDENT, "project_id": PROJECT, "category": "elevator",
                     "priority": "high", "description": "DO NOT COPY USER NARRATIVE"},
        "providers": [supplier()],
        "authorized_project": PROJECT, "human_role": "admin",
        "aal2_verified": True, "as_of": NOW
    }
    args.update(changes)
    return draft_provider_review(**args)

class ProviderTriageTests(unittest.TestCase):
    def test_minimal_scope_and_no_external_effect(self):
        result = triage()
        self.assertEqual(result["status"], "Pendiente de aprobación humana")
        self.assertEqual(len(result["candidates"]), 1)
        self.assertFalse(result["provider_contacted"])
        self.assertFalse(result["alert_sent"])
        self.assertFalse(result["work_order_created"])
        self.assertFalse(result["user_permissions_changed"])
        self.assertFalse(result["model_training_performed"])
        self.assertNotIn("PRIVATE-SYNTHETIC-CONTACT", str(result))
        self.assertNotIn("DO NOT COPY USER NARRATIVE", str(result))
        self.assertEqual(len(result["sha256"]), 64)

    def test_roles_mfa_cross_tenant_and_repeated_provider(self):
        for role in ("viewer", "technician", "agent", None):
            with self.subTest(role=role), self.assertRaises(ProviderTriageError):
                triage(human_role=role)
        with self.assertRaises(ProviderTriageError):
            triage(aal2_verified=False)
        with self.assertRaises(ProviderTriageError):
            triage(incident={"id": INCIDENT, "project_id": "other",
                             "category": "elevator", "priority": "high"})
        with self.assertRaises(ProviderTriageError):
            triage(providers=[supplier(project_id="other")])
        item = supplier()
        with self.assertRaises(ProviderTriageError):
            triage(providers=[item, item])

    def test_approved_current_matching_only(self):
        candidates = [
            supplier("Expirado", valid_until="2026-10-10T00:00:00Z"),
            supplier("Suspendido", status="suspended"),
            supplier("Otra actividad", specialties=["water"]),
            supplier("Verificado")
        ]
        result = triage(providers=candidates)
        self.assertEqual([x["name"] for x in result["candidates"]], ["Verificado"])
        with self.assertRaises(ProviderTriageError):
            triage(providers=[supplier(verified_at=None)])

    def test_invalid_shape_or_ambiguity_fail_closed(self):
        for kind in ("unknown", None, "plumbing"):
            with self.subTest(kind=kind), self.assertRaises(ProviderTriageError):
                triage(incident={"id":INCIDENT,"project_id":PROJECT,"category":kind,"priority":"high"})
        for catalog in (None, {}, [supplier(specialties=["malicious"])],
                        [supplier(display_name="")], [supplier(verified_at="bad-date")]):
            with self.subTest(catalog=str(catalog)[:25]), self.assertRaises(ProviderTriageError):
                triage(providers=catalog)

    def test_deterministic_hash_independent_of_source_order(self):
        first = supplier("Zeta")
        second = supplier("Alfa")
        a = triage(providers=[first,second])
        b = triage(providers=[second,first])
        self.assertEqual(a["sha256"], b["sha256"])
        self.assertEqual([x["name"] for x in a["candidates"]], ["Alfa","Zeta"])

    def test_reviewed_feedback_is_not_automatic_training(self):
        draft = triage()
        opts = {
            "draft":draft,"reviewer_id":REVIEWER,"outcome":"accepted",
            "lawful_basis_confirmed":True,"version":"qa1"
        }
        staging = stage_feedback_for_human_curation(**opts)
        self.assertTrue(staging["human_curation_required"])
        self.assertFalse(staging["persisted"])
        self.assertFalse(staging["model_trained"])
        self.assertNotIn("Proveedor sintético",str(staging))
        for patch in ({"lawful_basis_confirmed":False},{"outcome":"auto"},{"reviewer_id":"ai-agent"}):
            with self.assertRaises(ProviderTriageError):
                stage_feedback_for_human_curation(**(opts|patch))

if __name__ == "__main__":
    unittest.main()
