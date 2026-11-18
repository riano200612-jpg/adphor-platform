"""MISS ADPHOR provider matching — pure read-only, not a deployed agent.

The approved corporate supplier database has NOT been supplied. This module
takes already-authorized, tenant-scoped rows, never fetches or mutates anything.
Auth JWT, AAL2 and current membership MUST be verified by the caller's backend.
"""
from datetime import datetime, timezone
from hashlib import sha256
import json
import re
from uuid import UUID

KINDS = frozenset({"fire", "gas", "security", "elevator", "electrical", "water", "access", "hvac"})
PRIORITIES = frozenset({"standard", "high", "critical"})
PROJECT = re.compile(r"[A-Za-z0-9_-]{1,100}\Z")
PENDING = "Pendiente de aprobación humana"

class ProviderTriageError(ValueError):
    pass

def valid_uuid(value):
    if not isinstance(value, str):
        return False
    try:
        UUID(value)
        return True
    except ValueError:
        return False

def timestamp(value):
    if not isinstance(value, str) or len(value) > 40:
        return None
    try:
        date = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    if date.tzinfo is None:
        return None
    return date.astimezone(timezone.utc)

def _validated_provider(row, project_id):
    if not isinstance(row, dict) or row.get("project_id") != project_id:
        raise ProviderTriageError("Proveedor ajeno a la copropiedad.")
    specialties = row.get("specialties")
    if (not valid_uuid(row.get("id")) or not isinstance(row.get("display_name"), str)
        or not 1 <= len(row["display_name"].strip()) <= 120
        or not isinstance(specialties, list) or not 1 <= len(specialties) <= 12
        or len(specialties) != len(set(specialties))
        or any(kind not in KINDS for kind in specialties)
        or row.get("status") not in ("approved", "inactive", "suspended")
        or row.get("verified_at") is not None and not isinstance(row["verified_at"], str)
        or row.get("valid_until") is not None and not isinstance(row["valid_until"], str)):
        raise ProviderTriageError("Catálogo de proveedores inválido.")
    return row

def draft_provider_review(*, incident, providers, authorized_project,
                          human_role, aal2_verified, as_of):
    """Human-review proposal, NOT a supplier order, alert, notification or job."""
    if (not isinstance(authorized_project, str) or not PROJECT.fullmatch(authorized_project)
        or not isinstance(incident, dict)
        or incident.get("project_id") != authorized_project
        or not valid_uuid(incident.get("id"))):
        raise ProviderTriageError("Incidencia fuera de la copropiedad autorizada.")
    if human_role not in ("admin", "coordinator") or aal2_verified is not True:
        raise ProviderTriageError("Se requieren permisos administrativos y MFA AAL2.")
    if incident.get("category") not in KINDS or incident.get("priority") not in PRIORITIES:
        raise ProviderTriageError("Clasificación del incidente pendiente de verificación.")
    if not isinstance(as_of, datetime) or as_of.tzinfo is None:
        raise ProviderTriageError("Fecha del análisis inválida.")
    if not isinstance(providers, list) or len(providers) > 500:
        raise ProviderTriageError("Catálogo demasiado amplio o sin verificar.")

    current = as_of.astimezone(timezone.utc)
    seen = set()
    candidates = []
    for raw in providers:
        row = _validated_provider(raw, authorized_project)
        if row["id"] in seen:
            raise ProviderTriageError("Proveedor duplicado.")
        seen.add(row["id"])
        approved = timestamp(row.get("verified_at"))
        expiry = timestamp(row.get("valid_until"))
        if row["status"] == "approved" and (approved is None or expiry is None):
            raise ProviderTriageError("Aprobación del proveedor no verificable.")
        if row["status"] == "approved" and approved <= current < expiry and incident["category"] in row["specialties"]:
            candidates.append({
                "id": row["id"],
                "name": row["display_name"].strip(),
                "specialty": incident["category"],
                "basis": "recorded_approval_only"
            })

    candidates.sort(key=lambda x:(x["name"].casefold(),x["id"]))
    result = {
        "incident_id": incident["id"],
        "project_id": authorized_project,
        "category": incident["category"],
        "priority": incident["priority"],
        "engine": "rules",
        "source": "caller_supplied_tenant_scoped_catalog",
        "read_at": current.isoformat(),
        "candidates": candidates[:5],
        "status": PENDING,
        "human_approval_required": True,
        "provider_contacted": False,
        "alert_sent": False,
        "work_order_created": False,
        "user_permissions_changed": False,
        "model_training_performed": False
    }
    serialized = json.dumps(result, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    result["sha256"] = sha256(serialized.encode("utf-8")).hexdigest()
    return result

def stage_feedback_for_human_curation(*, draft, reviewer_id, outcome,
                                      lawful_basis_confirmed, version):
    """Minimized human-reviewed feedback proposal; no DB write, no training."""
    if (not isinstance(draft, dict) or draft.get("status") != PENDING
        or draft.get("human_approval_required") is not True
        or not valid_uuid(draft.get("incident_id"))
        or not isinstance(draft.get("sha256"), str)
        or not re.fullmatch(r"[a-f0-9]{64}", draft["sha256"])
        or not valid_uuid(reviewer_id) or outcome not in ("accepted", "rejected")
        or lawful_basis_confirmed is not True
        or not isinstance(version, str) or not re.fullmatch(r"[a-zA-Z0-9._-]{1,40}", version)):
        raise ProviderTriageError("No se cumplen los requisitos de aprendizaje supervisado.")
    return {
        "incident_ref": draft["incident_id"], "project_ref": draft["project_id"],
        "category": draft["category"], "review_outcome": outcome,
        "reviewer_ref": reviewer_id, "source_version": version,
        "proposal_hash": draft["sha256"], "human_curation_required": True,
        "persisted": False, "model_trained": False
    }
