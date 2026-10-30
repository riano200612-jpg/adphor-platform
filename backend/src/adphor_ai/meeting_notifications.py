"""Meeting notification planning for ADPHOR.

A plan is not a send. Actual delivery is exclusively handled by a separately
authorized server worker with recipient membership checks and idempotency.
"""
from __future__ import annotations
from datetime import datetime, timedelta, timezone

EVENTS = frozenset({"meeting_created", "meeting_changed", "meeting_cancelled", "meeting_reminder"})
ROLES = frozenset({"owner", "administrator", "management"})

def plan_meeting_email(*, project_id: str, meeting_id: str, event: str,
                       start_at: datetime, recipients: list[dict],
                       management_required: bool = False, reminder_hours: int = 24) -> list[dict]:
    if not project_id or not meeting_id or event not in EVENTS:
        raise ValueError("Datos de notificación inválidos")
    if start_at.tzinfo is None or reminder_hours < 0 or reminder_hours > 168:
        raise ValueError("Fecha o anticipación inválida")
    scheduled = start_at.astimezone(timezone.utc)
    if event == "meeting_reminder":
        scheduled -= timedelta(hours=reminder_hours)
    else:
        scheduled = datetime.now(timezone.utc)
    result = []
    seen = set()
    for row in recipients:
        if row.get("project_id") != project_id or row.get("role") not in ROLES:
            continue
        if row.get("role") == "management" and not management_required:
            continue
        # These identifiers must have been resolved server-side from approved memberships.
        uid = row.get("user_id")
        if not isinstance(uid, str) or not uid or not row.get("notifications_enabled", False):
            continue
        if uid in seen:
            continue
        seen.add(uid)
        result.append({"project_id":project_id, "meeting_id":meeting_id, "event":event,
                       "recipient_user_id":uid, "role":row["role"],
                       "scheduled_at":scheduled.isoformat(),
                       "idempotency_key":f"{project_id}:{meeting_id}:{event}:{uid}:{reminder_hours}",
                       "delivery_status":"pending_approval"})
    return result
