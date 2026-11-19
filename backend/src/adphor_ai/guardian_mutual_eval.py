"""ADPHOR Guardian: two independent, mutually checked QA route evaluators.

This is a deterministic, offline evaluation gate. It uses ONLY aggregate counts
from the already authorized QA Supabase database. No source text, tenants, files,
model calls, network requests, training, SQL writes or production operations.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from hashlib import sha256
import json
import re
from typing import Mapping

QA_SUPABASE_REF = "qfctnnnnltghepwujpdm"
DATA_KEYS = frozenset({
    "pilot_pqrs", "qa_meeting_events", "qa_visits", "qa_visit_evidence",
    "agent_runs", "agent_reviews",
})
REQUIRED_STEPS = (
    "verify_qa_access",
    "read_authorized_aggregates",
    "evaluate_correctness",
    "evaluate_security",
    "cross_check_evaluators",
    "record_audit_evidence",
)
OPTIONAL_STEPS = ("recheck_source_hash", "verify_consistency")
ALLOWED_STEPS = frozenset(REQUIRED_STEPS + OPTIONAL_STEPS)
ID_RE = re.compile(r"[A-Za-z][A-Za-z0-9_.-]{0,39}\Z")
SCOPE = "qa_admin_aggregate_only"
MIN_RELIABLE_OUTCOMES = 20


@dataclass(frozen=True)
class QaSnapshot:
    source_ref: str
    read_at: str
    totals: Mapping[str, int]
    scope: str = SCOPE


@dataclass(frozen=True)
class Candidate:
    version: str
    steps: tuple[str, ...]
    scope: str = SCOPE
    external_effect: bool = False
    reads_raw_records: bool = False


def _snapshot_digest(snapshot: QaSnapshot) -> str:
    """Strict schema: only non-sensitive, counted records cross this boundary."""
    if not isinstance(snapshot, QaSnapshot) or snapshot.source_ref != QA_SUPABASE_REF:
        raise ValueError("Solo se aceptan agregados de la base QA Integral.")
    if snapshot.scope != SCOPE or type(snapshot.read_at) is not str:
        raise ValueError("Alcance de auditoría no autorizado.")
    try:
        observed = datetime.fromisoformat(snapshot.read_at.replace("Z", "+00:00"))
    except ValueError:
        raise ValueError("Fecha de lectura inválida.") from None
    if observed.tzinfo is None or observed.utcoffset() is None:
        raise ValueError("La fecha de lectura necesita zona horaria.")
    if not isinstance(snapshot.totals, Mapping) or set(snapshot.totals) != DATA_KEYS:
        raise ValueError("La instantánea exige exclusivamente los seis contadores QA.")
    for value in snapshot.totals.values():
        if type(value) is not int or value < 0 or value > 10**9:
            raise ValueError("Solo se admiten conteos íntegros no negativos.")
    payload = {
        "source_ref": snapshot.source_ref, "read_at": snapshot.read_at,
        "scope": snapshot.scope, "totals": {k: snapshot.totals[k] for k in sorted(DATA_KEYS)},
    }
    return sha256(json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def _quality_audit(candidate: Candidate) -> dict:
    """Evaluator A: checks completeness, dependencies and minimal complexity."""
    steps = candidate.steps
    missing = tuple(x for x in REQUIRED_STEPS if x not in steps)
    distinct = len(steps) == len(set(steps))
    try:
        ordered = (
            steps.index("verify_qa_access") < steps.index("read_authorized_aggregates")
            < min(steps.index("evaluate_correctness"), steps.index("evaluate_security"))
            and max(steps.index("evaluate_correctness"), steps.index("evaluate_security"))
            < steps.index("cross_check_evaluators")
            < steps.index("record_audit_evidence")
            and steps[-1] == "record_audit_evidence"
        )
    except ValueError:
        ordered = False
    accepted = not missing and distinct and ordered
    return {
        "reviewer": "quality_guardian",
        "accepted": accepted,
        "missing": list(missing),
        "dependency_order_valid": ordered,
        "unique_steps": distinct,
        "step_count": len(steps),
    }


def _security_audit(candidate: Candidate) -> dict:
    """Evaluator B: independent, explicit safety and tenant boundary."""
    unknown = sorted(set(candidate.steps) - ALLOWED_STEPS)
    accepted = (
        candidate.scope == SCOPE
        and not candidate.external_effect
        and not candidate.reads_raw_records
        and not unknown
    )
    return {
        "reviewer": "security_guardian",
        "accepted": accepted,
        "qa_scope_only": candidate.scope == SCOPE,
        "no_external_effect": not candidate.external_effect,
        "no_raw_data": not candidate.reads_raw_records,
        "unknown_steps": unknown,
    }


def _quality_challenges_security(candidate: Candidate, security: dict) -> bool:
    """A verifies B's factual permission claims; never trusts B's verdict alone."""
    risks = {
        "qa_scope_only": candidate.scope == SCOPE,
        "no_external_effect": not candidate.external_effect,
        "no_raw_data": not candidate.reads_raw_records,
        "unknown_steps": sorted(set(candidate.steps) - ALLOWED_STEPS),
    }
    return (
        all(security.get(k) == v for k, v in risks.items())
        and security.get("accepted") == (
            risks["qa_scope_only"] and risks["no_external_effect"]
            and risks["no_raw_data"] and not risks["unknown_steps"]
        )
    )


def _security_challenges_quality(candidate: Candidate, quality: dict) -> bool:
    """B independently checks A's coverage and order proof."""
    steps = candidate.steps
    coverage = all(step in steps for step in REQUIRED_STEPS)
    no_duplicates = len(steps) == len(set(steps))
    dependencies = (
        coverage
        and steps[0] == "verify_qa_access"
        and steps[-1] == "record_audit_evidence"
        and steps.index("verify_qa_access") < steps.index("read_authorized_aggregates")
        < min(steps.index("evaluate_correctness"), steps.index("evaluate_security"))
        and max(steps.index("evaluate_correctness"), steps.index("evaluate_security"))
        < steps.index("cross_check_evaluators") < steps.index("record_audit_evidence")
    )
    return (
        quality.get("missing") == [x for x in REQUIRED_STEPS if x not in steps]
        and quality.get("unique_steps") == no_duplicates
        and quality.get("dependency_order_valid") == dependencies
        and quality.get("step_count") == len(steps)
        and quality.get("accepted") == (coverage and no_duplicates and dependencies)
    )


def compare_candidates(snapshot: QaSnapshot, candidates: tuple[Candidate, ...]) -> dict:
    """Choose the shortest CERTIFIED internal QA route, never deploy a model.

    Structural route review is not equivalent to measuring model answer accuracy.
    The two reviewers independently audit each candidate AND challenge the
    other review. Any mismatch or unsafe step fails closed.
    """
    evidence_hash = _snapshot_digest(snapshot)
    if not isinstance(candidates, tuple) or len(candidates) < 2 or len(candidates) > 12:
        raise ValueError("Se necesitan al menos dos versiones independientes.")
    names = [c.version for c in candidates if isinstance(c, Candidate)]
    if (len(names) != len(candidates) or len(set(names)) != len(names)
            or any(not isinstance(n, str) or not ID_RE.fullmatch(n) for n in names)):
        raise ValueError("Versiones inválidas, repetidas o sin identidad.")
    outcomes = []
    for c in candidates:
        if not isinstance(c.steps, tuple) or any(type(s) is not str for s in c.steps):
            raise ValueError("Los pasos deben ser identificadores inmutables.")
        if len(c.steps) > 24 or len(c.steps) == 0:
            raise ValueError("La ruta debe tener entre 1 y 24 pasos.")
        qa = _quality_audit(c)
        sa = _security_audit(c)
        a_checks_b = _quality_challenges_security(c, sa)
        b_checks_a = _security_challenges_quality(c, qa)
        eligible = qa["accepted"] and sa["accepted"] and a_checks_b and b_checks_a
        outcomes.append({
            "version": c.version,
            "eligible": eligible,
            "step_count": len(c.steps),
            "quality_review": qa,
            "security_review": sa,
            "mutual_verification": {
                "quality_checks_security": a_checks_b,
                "security_checks_quality": b_checks_a,
            },
        })
    approved = [o for o in outcomes if o["eligible"]]
    winner = min(approved, key=lambda o: (o["step_count"], o["version"])) if approved else None
    # A tiny operational corpus cannot certify model accuracy or a new version.
    useful = snapshot.totals["pilot_pqrs"] + snapshot.totals["qa_visits"]
    sufficient = useful >= MIN_RELIABLE_OUTCOMES and snapshot.totals["agent_runs"] >= MIN_RELIABLE_OUTCOMES
    return {
        "mode": "qa_aggregate_read_only",
        "snapshot_sha256": evidence_hash,
        "evaluators": ["quality_guardian", "security_guardian"],
        "routes": outcomes,
        "decision": "shortest_verified_qa_route" if winner else "blocked",
        "selected_route": winner["version"] if winner else None,
        "selected_steps": winner["step_count"] if winner else None,
        "model_quality_evidence_sufficient": sufficient,
        "model_version_certified": False,
        "external_actions_allowed": False,
        "automatic_deployment_allowed": False,
        "source_data_modified": False,
    }
