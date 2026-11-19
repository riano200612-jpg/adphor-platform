import unittest
from dataclasses import replace
from backend.src.adphor_ai.guardian_mutual_eval import (
    QaSnapshot, Candidate, compare_candidates, REQUIRED_STEPS,
)

REAL_QA_AGGREGATES = {
    "pilot_pqrs": 1,
    "qa_meeting_events": 32,
    "qa_visits": 1,
    "qa_visit_evidence": 1,
    "agent_runs": 0,
    "agent_reviews": 0,
}


class GuardianMutualEvaluationTests(unittest.TestCase):
    def setUp(self):
        self.snapshot = QaSnapshot(
            source_ref="qfctnnnnltghepwujpdm",
            read_at="2026-11-18T16:00:00+00:00",
            totals=REAL_QA_AGGREGATES,
        )
        self.long = Candidate(
            "version_A", tuple(REQUIRED_STEPS[:2]) + ("recheck_source_hash",)
            + tuple(REQUIRED_STEPS[2:]),
        )
        self.short = Candidate("version_B", tuple(REQUIRED_STEPS))

    def test_two_evaluators_mutually_certify_shortest_safe_qa_route(self):
        result = compare_candidates(self.snapshot, (self.long, self.short))
        self.assertEqual(result["decision"], "shortest_verified_qa_route")
        self.assertEqual(result["selected_route"], "version_B")
        self.assertEqual(result["selected_steps"], len(REQUIRED_STEPS))
        self.assertEqual(result["mode"], "qa_aggregate_read_only")
        self.assertEqual(len(result["evaluators"]), 2)
        for route in result["routes"]:
            self.assertTrue(route["eligible"])
            self.assertTrue(all(route["mutual_verification"].values()))
            self.assertNotEqual(route["quality_review"]["reviewer"],
                                route["security_review"]["reviewer"])
        self.assertFalse(result["external_actions_allowed"])
        self.assertFalse(result["automatic_deployment_allowed"])
        self.assertFalse(result["model_version_certified"])
        self.assertFalse(result["model_quality_evidence_sufficient"])
        self.assertFalse(result["source_data_modified"])

    def test_faster_unsafe_route_must_lose(self):
        danger = Candidate("short_unsafe", ("verify_qa_access",), external_effect=True)
        result = compare_candidates(self.snapshot, (danger, self.short))
        self.assertFalse(result["routes"][0]["eligible"])
        self.assertEqual(result["selected_route"], "version_B")
        self.assertFalse(result["routes"][0]["security_review"]["accepted"])

    def test_two_versions_neither_safe_results_block(self):
        unsafe = Candidate("unsafe", tuple(REQUIRED_STEPS), reads_raw_records=True)
        missing = Candidate("incomplete", tuple(REQUIRED_STEPS[:-1]))
        result = compare_candidates(self.snapshot, (unsafe, missing))
        self.assertEqual(result["decision"], "blocked")
        self.assertIsNone(result["selected_route"])

    def test_unknown_step_cross_tenant_and_external_action_fail_closed(self):
        for candidate in (
            Candidate("unknown", tuple(REQUIRED_STEPS) + ("send_email",)),
            Candidate("foreign", tuple(REQUIRED_STEPS), scope="other_project"),
            Candidate("writes", tuple(REQUIRED_STEPS), external_effect=True),
            Candidate("raw", tuple(REQUIRED_STEPS), reads_raw_records=True),
        ):
            out = compare_candidates(self.snapshot, (candidate, self.short))
            self.assertFalse(out["routes"][0]["eligible"])
            self.assertEqual(out["selected_route"], "version_B")

    def test_wrong_dependency_order_and_redundancy_rejected(self):
        missing = Candidate("missing", tuple(REQUIRED_STEPS[:-1]))
        shuffled = Candidate("reordered", tuple(reversed(REQUIRED_STEPS)))
        duplicate = Candidate("duplicate", tuple(REQUIRED_STEPS) + ("record_audit_evidence",))
        for route in (missing, shuffled, duplicate):
            out = compare_candidates(self.snapshot, (route, self.short))
            self.assertFalse(out["routes"][0]["quality_review"]["accepted"])

    def test_aggregate_snapshot_refuses_pii_and_forged_counts(self):
        for value in (-1, True, "1", None, 2.5):
            bad = dict(REAL_QA_AGGREGATES, pilot_pqrs=value)
            with self.assertRaises(ValueError):
                compare_candidates(replace(self.snapshot, totals=bad), (self.long, self.short))
        with self.assertRaises(ValueError):
            compare_candidates(replace(self.snapshot,
                totals=dict(REAL_QA_AGGREGATES, person_email="private@example.com")),
                (self.long, self.short))
        with self.assertRaises(ValueError):
            compare_candidates(replace(self.snapshot,
                source_ref="oqizvirqjwbbhyyjpthq"), (self.long, self.short))
        with self.assertRaises(ValueError):
            compare_candidates(replace(self.snapshot,
                scope="other_tenant"), (self.long, self.short))

    def test_non_utc_aware_timestamps_and_untrusted_structures_denied(self):
        for when in ("not-a-date", "2026-11-18T16:00:00", ""):
            with self.assertRaises(ValueError):
                compare_candidates(replace(self.snapshot, read_at=when),
                                   (self.long, self.short))
        with self.assertRaises(ValueError):
            compare_candidates(self.snapshot, (self.short,))
        with self.assertRaises(ValueError):
            compare_candidates(self.snapshot, (self.short, self.short))
        with self.assertRaises(ValueError):
            compare_candidates(self.snapshot, (self.short, Candidate("invalid", ["not-tuple"])))

    def test_reproducible_hash_and_tie_break_no_source_mutation(self):
        before = dict(REAL_QA_AGGREGATES)
        out1 = compare_candidates(self.snapshot, (self.long, self.short))
        out2 = compare_candidates(self.snapshot, (self.long, self.short))
        self.assertEqual(out1, out2)
        self.assertEqual(len(out1["snapshot_sha256"]), 64)
        self.assertEqual(before, REAL_QA_AGGREGATES)
        eq = compare_candidates(self.snapshot,
              (Candidate("version_Z", tuple(REQUIRED_STEPS)),
               Candidate("version_A", tuple(REQUIRED_STEPS))))
        self.assertEqual(eq["selected_route"], "version_A")

    def test_audit_alone_is_not_a_claim_of_model_superiority(self):
        high_counts = dict(REAL_QA_AGGREGATES, pilot_pqrs=100, agent_runs=50)
        result = compare_candidates(replace(self.snapshot, totals=high_counts),
                                    (self.long, self.short))
        self.assertTrue(result["model_quality_evidence_sufficient"])
        self.assertFalse(result["model_version_certified"])
        self.assertFalse(result["automatic_deployment_allowed"])


if __name__ == "__main__":
    unittest.main()
