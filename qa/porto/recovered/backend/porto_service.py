"""Framework-agnostic orchestration contract for the Porto Castello QA backend.

A Repo implementation MUST provide transactional persistence and check row locks.
The authenticated backend must derive user_id from a verified Supabase JWT, never
from a browser-supplied JSON field. This candidate is not wired to production.
"""
from dataclasses import dataclass
from datetime import datetime
from uuid import UUID
from .porto_business import meeting_decision


class AuthorizationError(PermissionError):
    pass


class ConflictError(RuntimeError):
    pass


@dataclass(frozen=True)
class Actor:
    id: str  # server-verified auth subject, never a client-provided field


class PortoService:
    def __init__(self, repo):
        self.repo=repo

    def authorize(self, actor: Actor, project_id: str, roles):
        actual=self.repo.membership_role(project_id,actor.id)
        if actual not in roles:
            raise AuthorizationError('No autorizado para esta copropiedad')

    def schedule(self, actor, project_id, title, start, end, now, *, reason=''):
        self.authorize(actor,project_id,{'admin','coordinator'})
        decision=meeting_decision(start,end,now)
        if decision.needs_manager_approval:
            if len(reason.strip())<10:
                raise ValueError('Motivo de urgencia requerido (10+ caracteres)')
            return self.repo.create_late_request(project_id,actor.id,title,start,end,reason)
        if not decision.allowed:
            raise ValueError(decision.reason)
        return self.repo.insert_meeting(project_id,actor.id,title,start,end)

    def decide_late(self, actor, project_id, request_id: UUID, approved: bool, now: datetime):
        self.authorize(actor,project_id,{'admin'})
        # Implementation MUST atomically: SELECT request FOR UPDATE, verify pending,
        # project and requester != actor; set decision; insert/update meeting against
        # DB trigger; consume request; enqueue manager notification audit.
        return self.repo.transactional_decide_late(project_id,actor.id,request_id,approved,now)

    def submit_daily_report(self, actor, project_id, report_date, summary, request_id: UUID):
        self.authorize(actor,project_id,{'admin','coordinator','technician'})
        if len(summary.strip())<10 or len(summary)>12000:
            raise ValueError('Resumen obligatorio: 10-12000 caracteres')
        # transactional insert with UNIQUE request_id; never expose agent outbox.
        # Report is source of truth immediately; agent KB only after validation.
        return self.repo.insert_report_idempotent(project_id,actor.id,report_date,summary,request_id)

    def create_upload_intent(self, actor, project_id, report_id, filename, mime, size):
        self.authorize(actor,project_id,{'admin','coordinator','technician'})
        if mime not in {'application/pdf','image/jpeg','image/png','image/webp','video/mp4','video/webm'}:
            raise ValueError('Tipo no admitido')
        if not 0<size<=50*1024*1024:
            raise ValueError('Excede el límite Free de 50 MB; mantener referencia privada en Drive')
        # Repo must verify report.project_id, sniff file, issue 5-minute URL and
        # check post-upload checksum/AV status before attachment enters reports.
        return self.repo.create_private_upload_intent(project_id,actor.id,report_id,filename,mime,size)

    def create_pqrs(self, actor, project_id, kind, subject, description):
        self.authorize(actor,project_id,{'admin','coordinator','technician'})
        if kind not in ('peticion','queja','reclamo','sugerencia'):
            raise ValueError('Tipo de PQRS no válido')
        if len(subject.strip())<3 or len(description.strip())<3:
            raise ValueError('Falta información obligatoria')
        return self.repo.insert_pqrs(project_id,actor.id,kind,subject,description)
