import os
from contextlib import asynccontextmanager
from typing import Annotated
from urllib.parse import urlsplit

import httpx
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

load_dotenv(override=False)

SUPABASE_URL = os.environ["SUPABASE_URL"].rstrip("/")
PUBLISHABLE_KEY = os.environ["SUPABASE_PUBLISHABLE_KEY"]
FRONTEND_ORIGIN = os.environ["FRONTEND_ORIGIN"].rstrip("/")

url = urlsplit(SUPABASE_URL)

if (
    url.scheme != "https"
    or not (url.hostname or "").endswith(".supabase.co")
    or url.username
    or url.password
    or url.port is not None
    or url.path
    or url.query
    or url.fragment
):
    raise RuntimeError("SUPABASE_URL no válida.")

if not PUBLISHABLE_KEY.startswith("sb_publishable_"):
    raise RuntimeError("Utiliza una clave publicable de Supabase.")

origin = urlsplit(FRONTEND_ORIGIN)

if (
    origin.scheme != "https"
    or not origin.hostname
    or origin.username
    or origin.password
    or origin.path
    or origin.query
    or origin.fragment
):
    raise RuntimeError("FRONTEND_ORIGIN debe ser un origen HTTPS.")


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with httpx.AsyncClient(
        base_url=SUPABASE_URL,
        timeout=httpx.Timeout(10.0, connect=5.0),
        follow_redirects=False,
        limits=httpx.Limits(
            max_connections=30,
            max_keepalive_connections=10,
        ),
    ) as client:
        app.state.supabase_http = client
        yield


app = FastAPI(
    title="ADPHOR API",
    lifespan=lifespan,
    debug=False,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN],
    allow_credentials=False,
    allow_methods=["GET"],
    allow_headers=["Authorization", "Content-Type"],
)

bearer = HTTPBearer(auto_error=False)


@app.middleware("http")
async def prevent_caching(request: Request, call_next):
    response = await call_next(request)
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    return response


async def supabase_get(
    request: Request,
    path: str,
    token: str,
    params: dict | None = None,
):
    try:
        response = await request.app.state.supabase_http.get(
            path,
            headers={
                "apikey": PUBLISHABLE_KEY,
                "Authorization": f"Bearer {token}",
            },
            params=params,
        )
    except httpx.TimeoutException:
        raise HTTPException(
            504, "Supabase no respondió a tiempo."
        ) from None
    except httpx.RequestError:
        raise HTTPException(
            503, "Servicio temporalmente no disponible."
        ) from None

    if response.status_code == 401:
        raise HTTPException(
            401,
            "Sesión inválida o vencida.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if response.status_code == 403:
        raise HTTPException(403, "Acceso denegado.")

    if response.status_code == 429:
        raise HTTPException(
            429, "Demasiadas solicitudes. Intenta más tarde."
        )

    if not response.is_success:
        raise HTTPException(
            502, "No fue posible consultar Supabase."
        )

    try:
        return response.json()
    except ValueError:
        raise HTTPException(
            502, "Respuesta inválida del servicio."
        ) from None


async def verified_token(
    request: Request,
    credentials: Annotated[
        HTTPAuthorizationCredentials | None,
        Depends(bearer),
    ],
) -> str:
    if credentials is None:
        raise HTTPException(
            401,
            "Debes iniciar sesión.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    user = await supabase_get(
        request,
        "/auth/v1/user",
        token,
    )

    if not isinstance(user, dict) or not user.get("id"):
        raise HTTPException(401, "Sesión inválida.")

    return token


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "agents_enabled": False,
    }


@app.get("/agent-runs")
async def list_agent_runs(
    request: Request,
    token: Annotated[str, Depends(verified_token)],
    project_id: Annotated[
        str,
        Query(
            min_length=1,
            max_length=100,
            pattern=r"^[A-Za-z0-9_-]+$",
        ),
    ],
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0, le=10000)] = 0,
):
    rows = await supabase_get(
        request,
        "/rest/v1/agent_run_status",
        token,
        params={
            "select": (
                "id,project_id,created_at,source_read_at,"
                "engine_kind,status,administrator_id,decided_at"
            ),
            "project_id": f"eq.{project_id}",
            "order": "created_at.desc,id.desc",
            "limit": str(limit),
            "offset": str(offset),
        },
    )

    return {
        "items": rows,
        "limit": limit,
        "offset": offset,
    }
