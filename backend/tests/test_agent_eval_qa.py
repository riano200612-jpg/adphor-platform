import unittest
from backend.src.adphor_ai.agent_eval_qa import Case, evaluate_agent_cases

class AgentEvaluationTests(unittest.TestCase):
    def test_metrics_and_no_external_delivery(self):
        rows=[
          Case("p1",frozenset({"overdue"}),frozenset({"overdue"}),12.0),
          Case("p1",frozenset({"unassigned"}),frozenset({"overdue"}),20.0)
        ]
        result=evaluate_agent_cases(rows)
        self.assertEqual(result["cases"],2)
        self.assertEqual(result["precision"],0.5)
        self.assertEqual(result["recall"],0.5)
        self.assertEqual(result["p95_latency_ms"],20)
        self.assertEqual(result["external_actions"],0)
    def test_cannot_perform_external_actions(self):
        with self.assertRaises(ValueError):
            evaluate_agent_cases([Case("p1",frozenset(),frozenset(),1,external_action_taken=True)])
    def test_cannot_use_empty_dataset(self):
        with self.assertRaises(ValueError):
            evaluate_agent_cases([])
