"""QA Integral Worker endpoints: authenticated AAL2 audit reads, no writes.

This module does not require a Worker runtime and can be unit tested entirely offline.
The frontend may continue using direct Supabase RLS reads until this Worker is
separately deployed and its Access / custom domain has been certified.
"""
import base64
import binascii
import json
import re
from urllib.parse import quote
from .gateway import Configuracion, ConexionError

QA_URL = "https://qfctnnnnltghepwujpdm.supabase.co"
QA_ORIGIN = "https://qa-integral-claude-reviewed.adphor-platform.pages.dev"
PROJECT = re.compile(r"[A-Za-z0-9_-]{1,100}\Z")
UUID = re.compile(r"[a-fA-F0-9]{8}-(?:[a-fA-F0-9]{4}-){3}[a-fA-F0-9]{12}\Z")
HASH = re.compile(r"[a-f0-9]{64}\Z")
STATUSES = frozenset({
    "Pendiente de aprobación del administrador",
    "Aprobado por el administrador",
    "Rechazado por el administrador",
})
SUMMARY = "id,project_id,created_at,source_read_at,engine_kind,status,administrator_id,decided_at"
DETAIL = SUMMARY + ",draft,result_hash,note"


def _parameters(query, allowed):
    if not isinstance(query, dict) or set(query) - set(allowed):
        raise ConexionError(400, "Parámetros de consulta no permitidos.")
    out = {}
    for key, values in query.items():
        if not isinstance(values, list) or len(values) != 1 or not isinstance(values[0], str):
            raise ConexionError(400, "Los parámetros no son válidos.")
        out[key] = values[0]
    project = out.get("project_id", "")
    if not PROJECT.fullmatch(project):
        raise ConexionError(400, "Selecciona una copropiedad válida.")
    return out


def _verify_aal2(bearer, user):
    # The exact bearer was already checked by /auth/v1/user. Decoding here
    # checks its assurance claims; it never substitutes for Auth validation.
    try:
        parts = bearer[7:].split(".")
        if len(parts) != 3 or not isinstance(user, dict):
            raise ValueError("token")
        payload = json.loads(base64.urlsafe_b64decode(parts[1] + "=" * (-len(parts[1]) % 4)))
        accepted = (
            isinstance(payload, dict)
            and isinstance(user.get("id"), str)
            and payload.get("sub") == user["id"]
            and payload.get("aal") == "aal2"
            and payload.get("role") == "authenticated"
        )
    except (ValueError, TypeError, KeyError, UnicodeDecodeError, binascii.Error):
        accepted = False
    if not accepted:
        raise ConexionError(403, "Completa MFA AAL2 para consultar el historial del enjambre.")


async def _get(fetch_json, url, headers, *, label, missing=502):
    try:
        status, data = await fetch_json(url, headers)
    except Exception:
        raise ConexionError(503, "El servicio de datos QA no respondió.") from None
    if status in (401, 403):
        raise ConexionError(403, "Sesión o permisos no válidos.")
    if status in (404, 406):
        raise ConexionError(missing, label)
    if status != 200:
        raise ConexionError(502, label)
    return data


async def handle_agent_readonly(config: Configuracion, bearer, method, path,
                                query, fetch_json, *, enabled=False):
    """Return a safe response body; the Worker supplies HTTP status and CORS.

    No writer key, outgoing POST, model inference, approval or case mutations.
    """
    if not enabled:
        raise ConexionError(503, "El backend QA del enjambre no está habilitado.")
    if config.supabase_url != QA_URL or config.origen_web != QA_ORIGIN:
        raise ConexionError(503, "La configuración no corresponde a QA Integral.")
    config.validar()
    if method != "GET":
        raise ConexionError(405, "El servicio solo admite lecturas.")
    if (not isinstance(bearer, str) or not bearer.startswith("Bearer ")
            or len(bearer) > 8192 or not bearer[7:].strip()):
        raise ConexionError(401, "Inicia sesión en ADPHOR.")

    detail_id = None
    if path == "/agent-readiness":
        args = _parameters(query, {"project_id"})
    elif path == "/agent-runs":
        args = _parameters(query, {"project_id", "limit", "offset"})
        if args.get("limit", "20") != "20":
            raise ConexionError(400, "El tamaño de página no está permitido.")
        if not re.fullmatch(r"(0|[1-9][0-9]{0,4})", args.get("offset", "0")):
            raise ConexionError(400, "La página del historial no es válida.")
        if int(args.get("offset", "0")) > 10000:
            raise ConexionError(400, "La página del historial no es válida.")
    elif path.startswith("/agent-runs/") and UUID.fullmatch(path[12:]):
        detail_id = path[12:]
        args = _parameters(query, {"project_id"})
    else:
        raise ConexionError(404, "Ruta del enjambre no disponible.")

    project = args["project_id"]
    base = config.supabase_url
    headers = {"apikey": config.clave_publica,
               "Authorization": bearer, "Cache-Control": "no-store"}
    try:
        status, user = await fetch_json(base + "/auth/v1/user", headers)
    except Exception:
        raise ConexionError(503, "No se pudo verificar tu sesión.") from None
    if status in (401, 403):
        raise ConexionError(401, "Tu sesión terminó. Inicia sesión nuevamente.")
    if status != 200 or not isinstance(user, dict) or not user.get("id"):
        raise ConexionError(502, "No se pudo verificar tu sesión.")
    _verify_aal2(bearer, user)

    # STABLE SECURITY DEFINER SQL function checks active identity and current
    # authenticated user; it is executable only by authenticated, not anon.
    role = await _get(fetch_json,
                      base + "/rest/v1/rpc/project_role?project=" + quote(project, safe=""),
                      headers, label="No se pudo verificar tu copropiedad.")
    if role not in ("admin", "coordinator"):
        raise ConexionError(403, "El historial exige Administración o Coordinación.")

    scope = "&project_id=eq." + quote(project, safe="")
    if path == "/agent-readiness":
        # Both registry and human-review table must be accessible through
        # the human JWT. This is NOT a statement that approval is enabled.
        runs = await _get(fetch_json,
                          base + "/rest/v1/agent_run_status?select=id&limit=0" + scope,
                          headers, label="El registro QA no está disponible.", missing=503)
        reviews = await _get(fetch_json,
                             base + "/rest/v1/agent_reviews?select=run_id&limit=0" + scope,
                             headers, label="La revisión humana QA no está disponible.", missing=503)
        if not isinstance(runs, list) or not isinstance(reviews, list):
            raise ConexionError(502, "El registro QA devolvió datos inválidos.")
        return {"mode": "qa_rules_only", "project_id": project,
                "registry_ready": True, "reviews_ready": False,
                "rules_ready": False, "models_ready": False}

    if detail_id is not None:
        endpoint = (base + "/rest/v1/agent_run_status?select=" + DETAIL + scope
                    + "&id=eq." + quote(detail_id, safe="") + "&limit=1")
        rows = await _get(fetch_json, endpoint, headers,
                          label="No se pudo consultar el borrador.")
        _validate_rows(rows, project, detail=True)
        if len(rows) != 1 or rows[0]["id"].lower() != detail_id.lower():
            raise ConexionError(404, "El borrador no está disponible para esta copropiedad.")
        return rows[0]

    offset = int(args.get("offset", "0"))
    endpoint = (base + "/rest/v1/agent_run_status?select=" + SUMMARY + scope
                + "&order=created_at.desc,id.desc&limit=20&offset=" + str(offset))
    rows = await _get(fetch_json, endpoint, headers, label="No se pudo consultar el historial.")
    _validate_rows(rows, project)
    return {"items": rows, "limit": 20, "offset": offset}


def _validate_rows(rows, project, detail=False):
    if not isinstance(rows, list) or len(rows) > (1 if detail else 20):
        raise ConexionError(502, "El registro QA devolvió datos inválidos.")
    for row in rows:
        if (not isinstance(row, dict)
                or row.get("project_id") != project
                or not isinstance(row.get("id"), str) or not UUID.fullmatch(row["id"])
                or row.get("engine_kind") not in ("rules", "models")
                or row.get("status") not in STATUSES
                or not isinstance(row.get("source_read_at"), str)
                or (detail and (not isinstance(row.get("draft"), str)
                                or not isinstance(row.get("result_hash"), str)
                                or not HASH.fullmatch(row["result_hash"])))):
            raise ConexionError(502, "El registro QA devolvió datos inconsistentes.")
