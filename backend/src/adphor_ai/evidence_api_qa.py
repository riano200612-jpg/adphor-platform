"""QA-only raw file endpoint for tenant-scoped private evidence.
Requires private Supabase Storage bucket policies and an isolated QA project.
No service role or email/WhatsApp provider is used.
"""
import os
import re
from uuid import uuid4
from fastapi import APIRouter, Depends, HTTPException, Request

MAX_BYTES = 20 * 1024 * 1024
CONTENT_TYPES = {
    "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp",
    "video/mp4": "mp4", "video/webm": "webm", "application/pdf": "pdf",
}
ID = re.compile(r"^[a-zA-Z0-9_-]{1,100}$")

def build_evidence_router(*, identity_dependency, membership_checker, http_get, base_url, publishable_key):
    router = APIRouter(tags=["evidence-qa"])

    @router.post("/qa/projects/{project_id}/cases/{case_id}/evidence")
    async def upload(project_id: str, case_id: str, request: Request,
                     actor=Depends(identity_dependency), kind: str = "pqrs"):
        if (os.getenv("ADPHOR_ISOLATED_QA") != "true" or
            base_url.rstrip("/").endswith("oqizvirqjwbbhyyjpthq.supabase.co")):
            raise HTTPException(503, "Carga disponible solo en un entorno QA aislado.")
        # Deployment owner must verify bucket.public=false and Storage RLS before opt-in.
        if os.getenv("ADPHOR_QA_PRIVATE_BUCKET_VERIFIED") != "true":
            raise HTTPException(503, "Políticas del bucket privado QA pendientes de validar.")
        bucket = os.getenv("ADPHOR_QA_EVIDENCE_BUCKET", "")
        if not re.fullmatch(r"[a-z0-9-]{3,63}", bucket):
            raise HTTPException(503, "Bucket privado QA no configurado.")
        if not ID.fullmatch(project_id) or not ID.fullmatch(case_id) or kind not in ("pqrs", "recorridos"):
            raise HTTPException(422, "Identificadores inválidos.")
        mime = request.headers.get("content-type", "").split(";")[0].strip().lower()
        if mime not in CONTENT_TYPES:
            raise HTTPException(415, "Formato de evidencia no permitido.")
        declared = request.headers.get("content-length")
        if declared and (not declared.isdigit() or int(declared) > MAX_BYTES):
            raise HTTPException(413, "Archivo demasiado grande.")
        # Do not read or store any bytes until membership and case existence are verified.
        await membership_checker(request, actor, project_id,
                                 ("admin", "coordinator", "technician", "viewer"))
        table = "pilot_pqrs" if kind == "pqrs" else "tickets"
        rows = await http_get(request, actor["token"], f"/rest/v1/{table}",
                              params={"select": "id", "project_id": f"eq.{project_id}",
                                      "id": f"eq.{case_id}", "limit": "1"})
        if not isinstance(rows, list) or len(rows) != 1:
            raise HTTPException(404, "Caso inexistente o no autorizado.")
        payload = await request.body()
        if not payload or len(payload) > MAX_BYTES:
            raise HTTPException(413, "Archivo vacío o demasiado grande.")
        key = f"{project_id}/{kind}/{case_id}/{uuid4().hex}.{CONTENT_TYPES[mime]}"
        headers = {"apikey": publishable_key, "Authorization": "Bearer " + actor["token"],
                   "Content-Type": mime, "x-upsert": "false"}
        try:
            response = await request.app.state.http.post(
                f"{base_url.rstrip('/')}/storage/v1/object/{bucket}/{key}",
                headers=headers, content=payload)
        except Exception:
            raise HTTPException(503, "No se pudo contactar el almacenamiento privado.") from None
        if response.status_code in (401, 403):
            raise HTTPException(403, "Storage denegó la carga; revisa RLS y permisos.")
        if not response.is_success:
            raise HTTPException(502, "Storage no confirmó la carga.")
        # A successful Storage write is not yet a persisted case-attachment metadata row.
        return {"id": key.rsplit("/", 1)[-1], "project_id": project_id,
                "case_id": case_id, "kind": kind, "visibility": "private",
                "storage_key": key, "storage_written": True,
                "metadata_linked": False, "notifications_sent": False}
    return router
