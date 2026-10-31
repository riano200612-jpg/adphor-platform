"""Offline QA evaluation harness for ADPHOR agent outputs.

No live customer data, no model training, no external network, and no automated decisions.
All metrics are computed from pre-approved synthetic/reference cases.
"""
from dataclasses import dataclass
from statistics import mean
from typing import Iterable

@dataclass(frozen=True)
class Case:
    project_id: str
    expected_labels: frozenset[str]
    predicted_labels: frozenset[str]
    duration_ms: float
    human_approved: bool = False
    external_action_taken: bool = False

def evaluate_agent_cases(cases: Iterable[Case]) -> dict:
    records = list(cases)
    if not records:
        raise ValueError("Se necesitan casos de evaluación")
    total_tp = total_fp = total_fn = 0
    latencies = []
    for case in records:
        if not case.project_id or case.duration_ms < 0:
            raise ValueError("Caso inválido")
        if case.external_action_taken:
            raise ValueError("La evaluación QA no permite acciones externas")
        expected, predicted = set(case.expected_labels), set(case.predicted_labels)
        total_tp += len(expected & predicted)
        total_fp += len(predicted - expected)
        total_fn += len(expected - predicted)
        latencies.append(case.duration_ms)
    precision = total_tp / (total_tp + total_fp) if total_tp + total_fp else 0.0
    recall = total_tp / (total_tp + total_fn) if total_tp + total_fn else 0.0
    latencies.sort()
    idx = max(0, -(-95 * len(latencies) // 100) - 1)
    return {
        "cases": len(records), "precision": round(precision, 4),
        "recall": round(recall, 4),
        "f1": round(2*precision*recall/(precision+recall), 4) if precision+recall else 0.0,
        "avg_latency_ms": round(mean(latencies), 2),
        "p95_latency_ms": round(latencies[idx], 2),
        "human_approvals": sum(c.human_approved for c in records),
        "external_actions": 0,
        "mode": "offline_qa_only",
    }
