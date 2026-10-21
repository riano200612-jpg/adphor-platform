"""Read-only Supabase connection probe. No model execution or mutation endpoints."""
import asyncio
from dataclasses import dataclass
import re
from urllib.parse import urlparse, quote


class ConexionError(Exception):
    def __init__(self, status, message):
        super().__init__(message)
        self.status = status


@dataclass(frozen=True)
class Configuracion:
    supabase_url: str
    clave_publica: str
    origen_web: str

    def validar(self):
        url = urlparse(self.supabase_url)
        if (url.scheme != 'https' or not url.hostname or
                not url.hostname.endswith('.supabase.co') or url.username or
                url.password or url.port or url.path not in ('', '/') or url.query or url.fragment):
            raise ConexionError(503, 'Configura una URL válida del proyecto Supabase.')
        if not self.clave_publica.startswith('sb_publishable_'):
            raise ConexionError(503, 'Configura la clave pública publishable de Supabase.')
        origin = urlparse(self.origen_web)
        if (origin.scheme != 'https' or not origin.netloc or origin.path or
                origin.query or origin.fragment or origin.username or origin.password):
            raise ConexionError(503, 'Configura el origen HTTPS exacto de la plataforma.')


async def verificar_sesion(config, bearer, propiedad_id, fetch_json):
    config.validar()
    if not bearer.startswith('Bearer ') or not bearer[7:].strip() or len(bearer) > 8192:
        raise ConexionError(401, 'Inicia sesión en ADPHOR.')
    if not re.fullmatch(r'[a-zA-Z0-9_-]{1,128}', propiedad_id or ''):
        raise ConexionError(400, 'Selecciona una copropiedad válida.')
    headers = {'apikey': config.clave_publica, 'Authorization': bearer,
               'Cache-Control': 'no-store'}
    base = config.supabase_url.rstrip('/')
    # Always verify the token with Auth; never decode and trust client claims.
    status, user = await fetch_json(base + '/auth/v1/user', headers)
    if status in (401, 403):
        raise ConexionError(401, 'La sesión no es válida o expiró.')
    if status != 200 or not isinstance(user, dict) or not user.get('id'):
        raise ConexionError(502, 'No se pudo verificar la sesión.')
    user_id = str(user['id'])
    url = (base + '/rest/v1/memberships?select=role&limit=2&user_id=eq.' +
           quote(user_id, safe='') + '&project_id=eq.' + quote(propiedad_id, safe=''))
    status, rows = await fetch_json(url, headers)
    if status != 200 or not isinstance(rows, list):
        raise ConexionError(502, 'No se pudo comprobar el acceso a la copropiedad.')
    if len(rows) != 1 or not isinstance(rows[0], dict) or rows[0].get('role') not in ('admin','coordinator','technician','viewer'):
        raise ConexionError(403, 'No tienes acceso a esta copropiedad.')
    role = rows[0]['role']
    return {'user_id': user_id, 'project_id': propiedad_id, 'role': role,
            'can_approve': role == 'admin', 'swarm_ready': False,
            'status': 'Conexión verificada; modelos y persistencia pendientes'}


async def verificar_con_timeout(*args):
    try:
        return await asyncio.wait_for(verificar_sesion(*args), timeout=10)
    except TimeoutError as error:
        raise ConexionError(504, 'La verificación tardó demasiado. Intenta nuevamente.') from error
