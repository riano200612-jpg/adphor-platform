"""Local ASGI API. Rules have no credentials; a separate writer only inserts runs."""
import asyncio
import os
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Annotated
from uuid import UUID

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, Depends, HTTPException, Request, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, ConfigDict, Field

from backend.src.adphor_ai.gateway import Configuracion
from backend.src.adphor_ai.rules import run_rules, PENDING
from backend.src.adphor_ai.meeting_api import build_meeting_router
from backend.src.adphor_ai.tenant_consultation import build_router, ConsultationSettings

load_dotenv(override=False)
BASE = os.environ.get("SUPABASE_URL", "").rstrip("/")
KEY = os.environ.get("SUPABASE_PUBLISHABLE_KEY", "")
ORIGIN = os.environ.get("FRONTEND_ORIGIN", "https://adphor-platform.pages.dev")
Config = Configuracion(BASE, KEY, ORIGIN)
PROJECTION = "id,project_id,status,assignee,due_date,version"
SUMMARY = "id,project_id,created_at,source_read_at,engine_kind,status,administrator_id,decided_at"


@asynccontextmanager
async def lifespan(app):
    Config.validar()
    async with httpx.AsyncClient(timeout=10, follow_redirects=False, trust_env=False) as client:
        app.state.http = client
        yield


app = FastAPI(title="ADPHOR · análisis por reglas", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=[ORIGIN], allow_methods=["GET", "POST"],
                   allow_headers=["Authorization", "Content-Type"], allow_credentials=False)
bearer = HTTPBearer(auto_error=False)


@app.middleware("http")
async def no_cache(request, call_next):
    response = await call_next(request)
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    return response


async def call(request, token, path, *, method="GET", params=None, body=None, writer_key=None):
    headers = {"apikey": writer_key or KEY, "Authorization": "Bearer " + token}
    if writer_key:
        # A legacy service-role JWT needs Authorization; modern secret keys use apikey.
        headers = {"apikey": writer_key, "Prefer": "return=minimal"}
        if writer_key.startswith("eyJ"):
            headers["Authorization"] = "Bearer " + writer_key
    try:
        response = await request.app.state.http.request(method, BASE + path, headers=headers, params=params, json=body)
    except httpx.RequestError:
        raise HTTPException(503, "No se pudo contactar con Supabase. Reintenta la misma solicitud.") from None
    if response.status_code in (401,403):
        raise HTTPException(503 if writer_key else response.status_code,
                            "Revisa la configuración del escritor." if writer_key else "Sesión o permisos no válidos.")
    if response.status_code == 409:
        raise HTTPException(409, "La solicitud ya existe. Consulta el historial o reintenta la misma solicitud.")
    if not response.is_success:
        raise HTTPException(502, "Supabase no pudo completar la operación.")
    if not response.content:
        return None
    try:
        return response.json()
    except ValueError:
        raise HTTPException(502, "Respuesta inválida de Supabase.") from None


async def identity(request: Request, credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)]):
    if credentials is None:
        raise HTTPException(401, "Debes iniciar sesión.", headers={"WWW-Authenticate":"Bearer"})
    user = await call(request, credentials.credentials, "/auth/v1/user")
    if not isinstance(user, dict) or not user.get("id"):
        raise HTTPException(401, "Sesión inválida.")
    return {"id": user["id"], "token": credentials.credentials}


async def require_role(request, actor, project, allowed):
    rows = await call(request, actor["token"], "/rest/v1/memberships", params={
        "select":"role", "project_id":f"eq.{project}", "user_id":f"eq.{actor['id']}", "limit":"2"})
    if not isinstance(rows, list) or len(rows) != 1 or rows[0]["role"] not in allowed:
        raise HTTPException(403, "Tu perfil no puede realizar esta acción en la copropiedad.")


# Default: disabled; staging + synthetic fixtures only; no real data adapter.
app.include_router(build_router(
    identity_dependency=identity, membership_checker=require_role,
    settings=ConsultationSettings(
        deployment=os.getenv("ADPHOR_DEPLOYMENT", "production"),
        mode=os.getenv("ADPHOR_CONSULTATION_MODE", "disabled"),
        supabase_url=BASE,
        staging_project_ref=os.getenv("ADPHOR_STAGING_PROJECT_REF", ""),
        frontend_origin=ORIGIN,
    ),
))

app.include_router(build_meeting_router(
    identity_dependency=identity, membership_checker=require_role,
    settings=ConsultationSettings(
        deployment=os.getenv("ADPHOR_DEPLOYMENT", "production"),
        mode=os.getenv("ADPHOR_CONSULTATION_MODE", "disabled"),
        supabase_url=BASE,
        staging_project_ref=os.getenv("ADPHOR_STAGING_PROJECT_REF", ""),
        frontend_origin=ORIGIN,
    ),
))

async def snapshot(request, actor, project):
    async def pages(table, select, order):
        data = []
        for offset in range(0, 5200, 200):
            batch = await call(request, actor["token"], "/rest/v1/" + table, params={
                "select":select, "project_id":f"eq.{project}", "order":order,
                "limit":"200", "offset":str(offset)})
            if not isinstance(batch, list):
                raise HTTPException(502, "Datos de origen inválidos.")
            data.extend(batch)
            if len(data) > 5000:
                raise HTTPException(422, "El piloto admite hasta 5000 registros por colección. No se generó un informe parcial.")
            if len(batch) < 200:
                return data
        raise HTTPException(422, "La colección supera el límite del piloto.")
    tickets = await pages("tickets", PROJECTION, "id.asc")
    members = await pages("memberships", "project_id,user_id,role", "user_id.asc")
    return tickets, members


class RunRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    project_id: str = Field(pattern=r"^[A-Za-z0-9_-]{1,100}$")
    request_id: UUID


@app.get("/health")
async def health():
    return {"status":"ok", "agents_enabled":False, "rules_available":True,
            "rules_persistence_configured": bool(os.environ.get("SUPABASE_AGENT_WRITER_KEY"))}


@app.get("/agent-runs")
async def list_runs(request: Request, actor: Annotated[dict, Depends(identity)],
                    project_id: str = Query(pattern=r"^[A-Za-z0-9_-]{1,100}$"),
                    limit: int = Query(default=20,ge=1,le=100), offset: int = Query(default=0,ge=0,le=10000)):
    await require_role(request, actor, project_id, ("admin", "coordinator"))
    data = await call(request, actor["token"], "/rest/v1/agent_run_status", params={
        "select":SUMMARY, "project_id":f"eq.{project_id}", "limit":str(limit),
        "offset":str(offset), "order":"created_at.desc,id.desc"})
    return {"items":data, "limit":limit, "offset":offset}


@app.get("/agent-runs/{run_id}")
async def detail(run_id: UUID, request: Request, actor: Annotated[dict, Depends(identity)]):
    data = await call(request, actor["token"], "/rest/v1/agent_run_status", params={
        "select":SUMMARY + ",draft,result_hash,note", "id":f"eq.{run_id}", "limit":"1"})
    if not data:
        raise HTTPException(404, "Ejecución no disponible.")
    return data[0]


@app.post("/agent-runs")
async def execute_rules(body: RunRequest, request: Request, actor: Annotated[dict, Depends(identity)]):
    await require_role(request, actor, body.project_id, ("admin",))
    run_id = str(body.request_id)
    existing = await call(request, actor["token"], "/rest/v1/agent_runs", params={
        "select":"id,project_id,source_snapshot", "id":f"eq.{run_id}", "limit":"1"})
    if existing:
        if existing[0]["project_id"] != body.project_id or existing[0]["source_snapshot"].get("requested_by") != actor["id"]:
            raise HTTPException(409, "El identificador pertenece a otra solicitud.")
        return {"id":run_id, "saved":True, "reused":True}
    writer = os.environ.get("SUPABASE_AGENT_WRITER_KEY", "")
    if not writer or not writer.startswith(("sb_secret_", "eyJ")):
        raise HTTPException(503, "Falta configurar la credencial privada de escritura en el servidor.")
    try:
        async with asyncio.timeout(60):
            first = await snapshot(request, actor, body.project_id)
            second = await snapshot(request, actor, body.project_id)
            if first != second:
                raise HTTPException(409, "Los datos cambiaron durante la lectura. Reintenta el análisis.")
            read_at = datetime.now(timezone.utc)
            try:
                payload = run_rules(body.project_id, *second, read_at, run_id, actor["id"])
            except (ValueError, KeyError, TypeError):
                raise HTTPException(422, "Hay datos de origen inconsistentes. No se guardó un borrador parcial.") from None
            await require_role(request, actor, body.project_id, ("admin",))
            # Only this fixed insert receives the private writer key. No approvals,
            # ticket writes, RPC calls or model tools are exposed by the writer.
            await call(request, "", "/rest/v1/agent_runs", method="POST", body=payload, writer_key=writer)
    except TimeoutError:
        raise HTTPException(504, "La ejecución tardó demasiado. Reintenta la misma solicitud.") from None
    return {"id":run_id, "saved":True, "status":PENDING}
