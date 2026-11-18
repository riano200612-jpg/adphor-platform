"""Miss ADPHOR: privacy-first knowledge and learning preflight (offline, pure).

This module does NOT read Google Drive, fetch Supabase rows, write to storage,
index documents, call a model or train anything. All session, RLS, legal and
tenant verifications must ALSO be performed by the future server-side gateway.
Only opaque metadata can enter this manifest, never raw source content.
"""
from __future__ import annotations

from datetime import datetime, timezone
from hashlib import sha256
from uuid import UUID
import json
import re

PROJECT_ID = re.compile(r"[A-Za-z0-9_-]{1,100}\Z")
SOURCE_ID = re.compile(r"[A-Za-z0-9_-]{12,128}\Z")
REVISION = re.compile(r"[A-Za-z0-9_.-]{1,60}\Z")
DIGEST = re.compile(r"[0-9a-f]{64}\Z")
RETRIEVAL_KINDS = frozenset({
    "maintenance_manual", "approved_policy", "safety_procedure",
    "approved_operations_guide", "approved_provider_directory"
})
QUARANTINE_KINDS = frozenset({
    "resident_identity", "security_recovery_questions", "credentials",
    "raw_pqrs", "raw_visits", "raw_calendar", "unreviewed_communications",
    "personnel_records", "legal_unreviewed", "financial_private"
})
ALLOWED_KEYS = frozenset({
    "source_id", "project_id", "source_kind", "version", "sha256",
    "classification", "privacy_reviewed", "owner_approved",
    "retention_until", "legal_basis_attested"
})
CLASSIFICATIONS = frozenset({"internal", "confidential", "restricted"})
SENSITIVE_KINDS = RETRIEVAL_KINDS | QUARANTINE_KINDS

class KnowledgeGovernanceRejected(ValueError):
    """A fail-closed metadata/source authorization failure."""

def _as_utc(value):
    if not isinstance(value, datetime) or value.tzinfo is None:
        raise KnowledgeGovernanceRejected("Fecha con zona horaria requerida.")
    return value.astimezone(timezone.utc)

def _check_human_context(project_id, actor_role, aal2_verified, membership_current):
    if not isinstance(project_id, str) or not PROJECT_ID.fullmatch(project_id):
        raise KnowledgeGovernanceRejected("Copropiedad inválida.")
    if actor_role not in ("admin", "coordinator") or aal2_verified is not True or membership_current is not True:
        raise KnowledgeGovernanceRejected("Se requiere sesión humana, pertenencia vigente y MFA AAL2.")

def _validate_source(source, project_id):
    if not isinstance(source, dict) or set(source) != ALLOWED_KEYS:
        raise KnowledgeGovernanceRejected("El manifiesto solo admite metadatos aprobados, no contenido original.")
    if source["project_id"] != project_id:
        raise KnowledgeGovernanceRejected("Fuente fuera de la copropiedad autorizada.")
    if not isinstance(source["source_id"], str) or not SOURCE_ID.fullmatch(source["source_id"]):
        raise KnowledgeGovernanceRejected("Identificador opaco de fuente inválido.")
    if not isinstance(source["version"], str) or not REVISION.fullmatch(source["version"]):
        raise KnowledgeGovernanceRejected("Versión de origen inválida.")
    if not isinstance(source["sha256"], str) or not DIGEST.fullmatch(source["sha256"]):
        raise KnowledgeGovernanceRejected("La fuente no tiene huella SHA-256 válida.")
    if (not isinstance(source["source_kind"], str) or source["source_kind"] not in SENSITIVE_KINDS
        or not isinstance(source["classification"], str) or source["classification"] not in CLASSIFICATIONS):
        raise KnowledgeGovernanceRejected("Categoría o clasificación desconocida.")
    if type(source["privacy_reviewed"]) is not bool or type(source["owner_approved"]) is not bool or type(source["legal_basis_attested"]) is not bool:
        raise KnowledgeGovernanceRejected("Estados de aprobación no verificables.")
    if not isinstance(source["retention_until"], str):
        raise KnowledgeGovernanceRejected("La fecha de retención es obligatoria.")
    try:
        retention = datetime.fromisoformat(source["retention_until"].replace("Z", "+00:00"))
    except ValueError:
        raise KnowledgeGovernanceRejected("Retención inválida.") from None
    return _as_utc(retention)

def plan_knowledge_ingestion(*, descriptors, authorized_project, actor_role,
                             aal2_verified, membership_current, now):
    """Prepare an auditable metadata-only quarantine/review manifest.

    Review eligibility is NOT permission to upload, index, retrieve or train.
    A future backend must verify live principal and source permissions, review
    actual content in a controlled environment and require an explicit approval.
    """
    _check_human_context(authorized_project, actor_role, aal2_verified, membership_current)
    now = _as_utc(now)
    if not isinstance(descriptors, list) or not 1 <= len(descriptors) <= 500:
        raise KnowledgeGovernanceRejected("Se requiere un lote de metadatos acotado.")
    seen = set()
    records = []
    for descriptor in descriptors:
        retention = _validate_source(descriptor, authorized_project)
        source_key = descriptor["source_id"]
        if source_key in seen:
            raise KnowledgeGovernanceRejected("Fuente duplicada.")
        seen.add(source_key)
        kind = descriptor["source_kind"]
        approved = all((
            descriptor["privacy_reviewed"],
            descriptor["owner_approved"],
            descriptor["legal_basis_attested"],
            descriptor["classification"] != "restricted",
            retention > now,
            kind in RETRIEVAL_KINDS,
        ))
        if kind in QUARANTINE_KINDS:
            approved = False
        records.append({
            "source_id": source_key,
            "project_id": authorized_project,
            "version": descriptor["version"],
            "source_sha256": descriptor["sha256"],
            "source_kind": kind,
            "classification": descriptor["classification"],
            "decision": "eligible_for_private_index_review" if approved else "quarantined",
            "raw_content_exported": False,
            "indexed": False,
            "retrieval_enabled": False,
            "training_enabled": False,
        })
    records.sort(key=lambda r: r["source_id"])
    manifest = {
        "project_id": authorized_project,
        "engine": "metadata_rules_only",
        "generated_at": now.isoformat(),
        "documents": records,
        "eligible_count": sum(r["decision"] == "eligible_for_private_index_review" for r in records),
        "quarantined_count": sum(r["decision"] == "quarantined" for r in records),
        "human_review_required": True,
        "upload_performed": False,
        "indexing_performed": False,
        "model_trained": False,
        "external_notifications_sent": False,
    }
    manifest["manifest_sha256"] = sha256(json.dumps(
        manifest, sort_keys=True, ensure_ascii=False, separators=(",", ":")
    ).encode("utf-8")).hexdigest()
    return manifest

def stage_learning_review(*, manifest, source_id, human_reviewer_id,
                          feedback_outcome, lawful_basis_attested,
                          evaluation_passed, source_hash):
    """Create a minimized staging proposal; NEVER self-train or persist."""
    if not isinstance(manifest, dict) or manifest.get("engine") != "metadata_rules_only":
        raise KnowledgeGovernanceRejected("Manifiesto no verificable.")
    saved = manifest.get("manifest_sha256")
    if not isinstance(saved, str) or not DIGEST.fullmatch(saved):
        raise KnowledgeGovernanceRejected("Huella de manifiesto ausente.")
    original = {k: v for k, v in manifest.items() if k != "manifest_sha256"}
    recalculated = sha256(json.dumps(
        original, sort_keys=True, ensure_ascii=False, separators=(",", ":")
    ).encode("utf-8")).hexdigest()
    if saved != recalculated:
        raise KnowledgeGovernanceRejected("El manifiesto fue alterado.")
    if not isinstance(manifest.get("documents"), list):
        raise KnowledgeGovernanceRejected("Fuentes no verificables.")
    matching = [x for x in manifest["documents"] if isinstance(x, dict) and x.get("source_id") == source_id]
    if len(matching) != 1 or matching[0].get("decision") != "eligible_for_private_index_review":
        raise KnowledgeGovernanceRejected("Fuente no habilitada para revisión.")
    if source_hash != matching[0]["source_sha256"] or not isinstance(source_hash, str) or not DIGEST.fullmatch(source_hash):
        raise KnowledgeGovernanceRejected("La fuente cambió.")
    try:
        UUID(human_reviewer_id)
    except (ValueError, TypeError, AttributeError):
        raise KnowledgeGovernanceRejected("Revisor humano inválido.") from None
    if (feedback_outcome not in ("useful", "incorrect", "needs_review")
        or lawful_basis_attested is not True or evaluation_passed is not True):
        raise KnowledgeGovernanceRejected("Retroalimentación no aprobada o evaluación fallida.")
    return {
        "project_id": manifest["project_id"],
        "source_id": source_id,
        "source_sha256": source_hash,
        "manifest_sha256": saved,
        "reviewer_id": human_reviewer_id,
        "feedback_outcome": feedback_outcome,
        "ready_for_human_dataset_review": True,
        "persisted": False,
        "model_trained": False,
        "retrieval_enabled": False,
        "authorization_granted": False,
    }
