"""Fail-closed notification policy for ADPHOR QA.

Account lockouts are security events, NEVER a reason to send mail automatically.
No provider import or outbound network calls exist in this module.
"""
from __future__ import annotations
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

@dataclass(frozen=True)
class NotificationDecision:
    allowed: bool
    reason: str

def authorize_delivery(*, environment: str, explicit_approval: bool = False,
                       delivery_enabled: bool = False, channel: str = "email") -> NotificationDecision:
    if channel not in {"email", "sms", "whatsapp", "calendar_invitation"}:
        return NotificationDecision(False, "Canal desconocido")
    if environment != "production":
        return NotificationDecision(False, "Entorno QA: envíos desactivados")
    if not explicit_approval or not delivery_enabled:
        return NotificationDecision(False, "Falta aprobación específica y activación del proveedor")
    return NotificationDecision(True, "Entrega aprobada")

def record_lockout(*, project_id: str, actor_id: str, account_type: str,
                   failed_attempts: int) -> dict[str, Any]:
    """Generate an audit payload; caller persists it with tenant-scoped permissions.

    Never insert passwords, PINs, email addresses or tokens into this payload.
    """
    if account_type not in {"delegate", "resident"}:
        raise ValueError("Tipo de cuenta inválido")
    if not project_id or not actor_id or failed_attempts < 1:
        raise ValueError("Evento incompleto")
    return {"kind": "account_lockout", "project_id": project_id,
            "actor_id": actor_id, "account_type": account_type,
            "failed_attempts": failed_attempts,
            "occurred_at": datetime.now(timezone.utc).isoformat(),
            "notification_status": "suppressed_pending_approval"}
