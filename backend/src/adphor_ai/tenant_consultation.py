"""ADPHOR tenant consultation gate. Strictly synthetic-only until formal release.

This code never imports or queries adphor_ingest/public production records. A
server-side Auth + current membership check is mandatory in the router.
"""
from __future__ import annotations

from dataclasses import dataclass
import re
from typing import Mapping, Sequence

from fastapi import APIRouter, Depends, HTTPException, Query, Request

PROJECT_ID = re.compile(r"^[a-z0-9][a-z0-9-]{0,99}$")
READ_ROLES = ("admin", "coordinator", "technician", "viewer")
PRODUCTION_REF = "oqizvirqjwbbhyyjpthq"
PRODUCTION_ORIGIN = "https://adphor-platform.pages.dev"


@dataclass(frozen=True)
class ConsultationSettings:
    deployment: str = "production"
    mode: str = "disabled"
    supabase_url: str = ""
    staging_project_ref: str = ""
    frontend_origin: str = PRODUCTION_ORIGIN

    def assert_sandbox(self) -> None:
        # These values are server-owned and never accepted from a request.
        expected_url = f"https://{self.staging_project_ref}.supabase.co"
        if not (
            self.deployment == "staging" and self.mode == "synthetic"
            and bool(self.staging_project_ref)
            and self.staging_project_ref != PRODUCTION_REF
            and self.supabase_url.rstrip("/") == expected_url
            and self.frontend_origin.startswith("https://")
            and self.frontend_origin != PRODUCTION_ORIGIN
        ):
            raise HTTPException(503, "Consulta deshabilitada hasta aprobar aislamiento y correspondencias.")


# Fixed, non-sensitive fixtures. No personal names, source IDs, real tenant IDs or photos.
SYNTHETIC_ROWS = (
    {"project_id": "00000000-0000-0000-0000-000000000001", "id": "synthetic-a-1", "status": "Pendiente", "category": "reunion"},
    {"project_id": "00000000-0000-0000-0000-000000000001", "id": "synthetic-a-2", "status": "Cerrada", "category": "reunion"},
    {"project_id": "00000000-0000-0000-0000-000000000002", "id": "synthetic-b-1", "status": "Pendiente", "category": "reunion"},
    {"project_id": "00000000-0000-0000-0000-000000000002", "id": "synthetic-b-2", "status": "Pendiente", "category": "pqrs"},
)


class SyntheticConsultation:
    def __init__(self, rows: Sequence[Mapping[str, str]] = SYNTHETIC_ROWS):
        self._rows = tuple(dict(r) for r in rows)
        for r in self._rows:
            if not isinstance(r.get("project_id"), str) or not PROJECT_ID.fullmatch(r["project_id"]):
                raise ValueError("Un registro sintético no tiene copropiedad válida.")

    def summary(self, project_id: str) -> dict:
        if not PROJECT_ID.fullmatch(project_id):
            raise HTTPException(422, "Identificador de copropiedad inválido.")
        # Project-filtering at the source, not in the UI.
        visible = [r for r in self._rows if r["project_id"] == project_id]
        counts = {"events": 0, "pqrs": 0, "pending": 0}
        for r in visible:
            if r.get("category") == "reunion":
                counts["events"] += 1
            elif r.get("category") == "pqrs":
                counts["pqrs"] += 1
            else:
                raise HTTPException(503, "Fixture no autorizada.")
            if r.get("status") == "Pendiente":
                counts["pending"] += 1
        return {"project_id": project_id, "source": "synthetic", "agent_access": False,
                "record_count": len(visible), "totals": counts}


def build_router(*, identity_dependency, membership_checker,
                 settings: ConsultationSettings, store: SyntheticConsultation | None = None) -> APIRouter:
    """Injection uses existing /auth/v1/user and live membership authorization.

    identity_dependency must validate Supabase Auth server-side.
    membership_checker(request, actor, project_id, allowed_roles) must re-check
    currently active membership on every request, never JWT user_metadata.
    """
    router = APIRouter(prefix="/consultation", tags=["consultation"])
    store = store or SyntheticConsultation()

    @router.get("/summary")
    async def consultation_summary(request: Request,
                                   project_id: str = Query(min_length=1, max_length=100),
                                   actor: dict = Depends(identity_dependency)):
        settings.assert_sandbox()  # fail-closed, including if someone enables a flag in prod
        if not PROJECT_ID.fullmatch(project_id):
            raise HTTPException(422, "Identificador de copropiedad inválido.")
        if not isinstance(actor, dict) or not actor.get("id") or not actor.get("token"):
            raise HTTPException(401, "Identidad no verificada.")
        await membership_checker(request, actor, project_id, READ_ROLES)
        response = store.summary(project_id)
        # Redundant invariant: response tenant can never differ from request tenant.
        if response["project_id"] != project_id or response["source"] != "synthetic":
            raise HTTPException(503, "Respuesta de origen no confiable.")
        return response

    return router
