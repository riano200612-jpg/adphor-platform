"""Reglas determinísticas de agenda ADPHOR (sin decisiones de seguridad delegadas a IA)."""
from datetime import datetime, timedelta
from typing import Iterable

LEVELS = ("bajo", "medio", "alto")
KEYWORDS_HIGH = ("emergencia", "riesgo estructural", "seguridad", "incendio", "inundación", "junta extraordinaria")
KEYWORDS_MEDIUM = ("pqrs", "mantenimiento", "queja", "reclamo", "informe diario")


def classify_priority(text: str, pqrs_type: str = "", impact: str = "") -> dict:
    """Clasificación explicable provisional; cualquier IA posterior solo propone."""
    corpus = " ".join((text or "", pqrs_type or "", impact or "")).casefold()
    if any(word in corpus for word in KEYWORDS_HIGH):
        return {"priority_level": "alto", "requires_management": True, "reason": "Regla de criticidad alta"}
    if any(word in corpus for word in KEYWORDS_MEDIUM):
        return {"priority_level": "medio", "requires_management": False, "reason": "Seguimiento administrativo"}
    return {"priority_level": "bajo", "requires_management": False, "reason": "Gestión ordinaria"}


def validate_slot(start: datetime, end: datetime, existing: Iterable[dict],
                  participants: Iterable[str], requires_management: bool,
                  buffer_minutes: int = 15, exclude_id=None) -> list[dict]:
    """Retorna bloqueos; intervalos semiabiertos [inicio, fin) con margen preventivo.
    Los horarios deben ser timezone-aware y estar normalizados por quien llame.
    La base de datos debe revalidar dentro de una transacción para evitar carreras.
    """
    if start.tzinfo is None or end.tzinfo is None:
        raise ValueError("Las fechas deben incluir zona horaria")
    if end <= start:
        raise ValueError("La fecha de fin debe ser posterior al inicio")
    if buffer_minutes < 0:
        raise ValueError("El margen no puede ser negativo")
    people = set(participants)
    if requires_management:
        people.add("management")
    conflicts = []
    for item in existing:
        if exclude_id is not None and item.get("id") == exclude_id:
            continue
        if item.get("status") == "cancelled":
            continue
        shared = people.intersection(set(item.get("participants") or []))
        if item.get("requires_management") and requires_management:
            shared.add("management")
        if not shared:
            continue
        other_start, other_end = item["starts_at"], item["ends_at"]
        if other_start.tzinfo is None or other_end.tzinfo is None:
            raise ValueError("Agenda existente sin zona horaria")
        margin = timedelta(minutes=buffer_minutes) if (
            requires_management or item.get("requires_management")
        ) else timedelta()
        if start < other_end + margin and end > other_start - margin:
            conflicts.append({"meeting_id": item.get("id"), "shared": sorted(shared)})
    return conflicts


def authorize_change(meeting: dict, actor_role: str, management_approval: bool) -> None:
    """El frontend no es autoridad: aplicar también en backend/RPC con auditoría."""
    if meeting.get("priority_level") == "alto" and (
        actor_role not in ("superadmin", "administrator") or not management_approval
    ):
        raise PermissionError("Requiere autorización administrativa superior y acto de aprobación")


def validate_meeting_request(start: datetime, end: datetime, now: datetime,
                             existing: Iterable[dict], participants: Iterable[str],
                             requires_management: bool, actor_role: str = "viewer",
                             approval: bool = False, meeting: dict | None = None) -> dict:
    """Validación preliminar en backend; revalidar transaccionalmente al guardar."""
    if now.tzinfo is None or start.tzinfo is None or end.tzinfo is None:
        raise ValueError("La fecha debe incluir zona horaria")
    if end <= start or start <= now:
        return {"allowed": False, "reason": "Horario inválido o pasado"}
    conflicts = validate_slot(start, end, existing, participants, requires_management)
    if conflicts:
        return {"allowed": False, "reason": "Conflictos de agenda", "conflicts": conflicts}
    if meeting is not None:
        try:
            authorize_change(meeting, actor_role, approval)
        except PermissionError:
            return {"allowed": False, "reason": "Autorización superior requerida",
                    "request_exception": True}
    if start - now < timedelta(hours=24) and not approval:
        return {"allowed": False, "reason": "Ventana inferior a 24 horas",
                "request_exception": True}
    return {"allowed": True}
