"""Clasificación explicable y preparación segura de avisos de reuniones Porto Castello.

No envía mensajes: cada destinatario/canal necesita consentimiento, permisos y
un proveedor autenticado. La persistencia y el despacho mediante una outbox todavía no están implementados.
"""
from dataclasses import dataclass
from typing import Iterable
from .meeting_priority import classify_priority


@dataclass(frozen=True)
class Decision:
    priority_level: str
    requires_management: bool
    reason: str


def assess_meeting(subject: str, notes: str = "", kind: str = "",
                   impact: str = "", management_requested: bool = False) -> Decision:
    if not (subject or "").strip():
        raise ValueError("El asunto de la reunión es obligatorio")
    result = classify_priority(" ".join((subject, notes)), kind, impact)
    required = result["requires_management"] or management_requested
    reason = result["reason"]
    if management_requested and not result["requires_management"]:
        reason += "; participación gerencial solicitada por la administradora"
    return Decision(result["priority_level"], required, reason)


def build_notification_intents(meeting_id: str, project_id: str, decision: Decision,
                               contacts: Iterable[dict]) -> list[dict]:
    """Crea intenciones sin números ni mensajes transmitidos; filtro explícito por canal."""
    if not meeting_id or not project_id:
        raise ValueError("Identificadores obligatorios")
    if not decision.requires_management:
        return []
    events = []
    seen = set()
    for contact in contacts:
        if contact.get("project_id") != project_id or contact.get("role") not in ("admin", "management"):
            continue
        for channel in ("email", "sms", "whatsapp"):
            address = contact.get(channel)
            if not address or contact.get(f"consent_{channel}") is not True:
                continue
            recipient = contact.get('id')
            if not isinstance(recipient, str) or not recipient.strip():
                continue
            identity = (project_id, meeting_id, recipient, channel)
            if identity in seen:
                continue
            seen.add(identity)
            events.append({
                "idempotency_key": f"{project_id}:{meeting_id}:{contact['id']}:{channel}:management",
                "project_id": project_id,
                "meeting_id": meeting_id,
                "recipient_id": contact["id"],
                "channel": channel,
                "type": "management_attendance_requested",
                "status": "pending_review",
            })
    return events
