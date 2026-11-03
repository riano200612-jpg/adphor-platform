"""Cloudflare Worker bootstrap: health, readiness and authenticated read-only probe."""
import json
from urllib.parse import urlparse, parse_qs
from workers import WorkerEntrypoint, Response, fetch
from adphor_ai.gateway import Configuracion, ConexionError, verificar_con_timeout


class Default(WorkerEntrypoint):
    async def fetch(self, request):
        origin = request.headers.get('Origin') or ''
        allowed = getattr(self.env, 'ALLOWED_ORIGIN', '')
        headers = {'Content-Type': 'application/json; charset=utf-8',
                   'Cache-Control': 'no-store', 'Vary': 'Origin',
                   'X-Content-Type-Options': 'nosniff'}
        if origin and origin != allowed:
            return Response(json.dumps({'error':'Origen no permitido.'}), status=403, headers=headers)
        if origin == allowed and allowed:
            headers.update({'Access-Control-Allow-Origin':allowed,
                            'Access-Control-Allow-Methods':'GET, OPTIONS',
                            'Access-Control-Allow-Headers':'Authorization, Content-Type'})
        def reply(data, status=200):
            return Response(json.dumps(data, ensure_ascii=False), status=status, headers=headers)
        if request.method == 'OPTIONS':
            return Response('', status=204, headers=headers)
        if request.method != 'GET':
            return reply({'error':'Esta etapa solo permite consultas; no ejecuta ni aprueba el enjambre.'},405)
        url = urlparse(request.url)
        if url.path == '/health':
            return reply({'service':'adphor-ai','status':'connection-only'})
        if url.path == '/ready':
            return reply({'ready':False,'pending':['modelos_ml_dl_pln','persistencia_auditoria','api_de_aprobacion']},503)
        if url.path != '/v1/session':
            return reply({'error':'Ruta no disponible.'},404)
        config = Configuracion(getattr(self.env,'SUPABASE_URL',''),
                               getattr(self.env,'SUPABASE_PUBLISHABLE_KEY',''), allowed)
        async def fetch_json(url, auth_headers):
            response = await fetch(url, method='GET', headers=auth_headers, redirect='error')
            try:
                data = await response.json()
            except Exception:
                data = None
            return response.status, data
        try:
            project_id = parse_qs(url.query).get('project_id',[''])[0]
            return reply(await verificar_con_timeout(config, request.headers.get('Authorization') or '', project_id, fetch_json))
        except ConexionError as error:
            return reply({'error':str(error)}, error.status)
        except Exception:
            # Never expose provider response bodies, tokens or internal traces.
            return reply({'error':'No fue posible comprobar la conexión.'},502)
