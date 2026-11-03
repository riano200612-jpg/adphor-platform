"""Portable business rules for the ADPHOR Porto Castello pilot.

The backend AND a Postgres trigger must enforce the 24-hour lock. A UI check
alone is never authorization. All timestamps are timezone-aware instants.
"""
from dataclasses import dataclass
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

BOGOTA = ZoneInfo("America/Bogota")
WINDOW = timedelta(hours=24)


@dataclass(frozen=True)
class MeetingAction:
    allowed: bool
    needs_manager_approval: bool
    reason: str


def validate_meeting_times(start: datetime, end: datetime) -> None:
    if start.tzinfo is None or end.tzinfo is None:
        raise ValueError("Se requieren fechas con zona horaria")
    if end <= start:
        raise ValueError("La hora final debe ser posterior a la inicial")


def meeting_decision(start: datetime, end: datetime, now: datetime,
                     *, original_start: datetime | None = None) -> MeetingAction:
    """Under 24h to a NEW or EXISTING meeting, require management approval."""
    validate_meeting_times(start, end)
    if now.tzinfo is None or (original_start is not None and original_start.tzinfo is None):
        raise ValueError("Reloj y fecha original deben incluir zona horaria")
    if start <= now:
        return MeetingAction(False, False, "No se puede agendar una reunión pasada")
    if start - now < WINDOW or (original_start is not None and original_start - now < WINDOW):
        return MeetingAction(False, True, "Bloqueo de 24 horas: solicitar aprobación de Gerencia")
    return MeetingAction(True, False, "Dentro de la ventana de programación")


def confirmation_due_at(starts_at: datetime) -> datetime:
    if starts_at.tzinfo is None:
        raise ValueError("start_at debe incluir zona horaria")
    return starts_at - WINDOW


def report_reminder_due(report_date, local_hour: int = 17, local_minute: int = 0) -> datetime:
    if not (0 <= local_hour <= 23 and 0 <= local_minute < 60):
        raise ValueError("Hora inválida")
    return datetime(report_date.year, report_date.month, report_date.day,
                    local_hour, local_minute, tzinfo=BOGOTA)
