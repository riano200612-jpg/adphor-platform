export function agentApiOrigin(value, development = false) {
  if (!value) return null;
  const url = new URL(value);
  const local = development && ['localhost', '127.0.0.1'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !(local && url.protocol === 'http:')) || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('La dirección del servicio de asistentes no es válida.');
  }
  return url.origin;
}

export async function fetchAgentRuns({origin, token, projectId, offset = 0, fetcher = fetch}) {
  if (!token) throw new Error('Tu sesión terminó. Vuelve a ingresar.');
  const url = new URL('/agent-runs', origin);
  url.search = new URLSearchParams({project_id: projectId, limit: '20', offset: String(offset)});
  const response = await fetcher(url, {
    headers: {Authorization: `Bearer ${token}`},
    signal: AbortSignal.timeout(15000), cache: 'no-store', redirect: 'error', credentials: 'omit',
  });
  if (response.status === 401) throw new Error('Tu sesión terminó. Vuelve a ingresar.');
  if (response.status === 403) throw new Error('No tienes permiso para consultar este historial.');
  if (!response.ok) throw new Error('No se pudo consultar el historial. Intenta nuevamente.');
  const data = await response.json();
  if (!Array.isArray(data.items) || data.items.some(item => !item || item.project_id !== projectId)) throw new Error('El servicio devolvió una respuesta no válida.');
  return data.items;
}

export async function agentRuleRequest({origin, token, projectId, requestId, runId, fetcher = fetch}) {
  if (!token) throw new Error('Tu sesión terminó. Vuelve a ingresar.');
  const path = runId ? `/agent-runs/${encodeURIComponent(runId)}` : '/agent-runs';
  const response = await fetcher(new URL(path, origin), {
    method: runId ? 'GET' : 'POST',
    headers: {Authorization: `Bearer ${token}`, 'Content-Type': 'application/json'},
    ...(runId ? {} : {body: JSON.stringify({project_id: projectId, request_id: requestId})}),
    signal: AbortSignal.timeout(70000), cache: 'no-store', redirect: 'error', credentials: 'omit',
  });
  if (!response.ok) {
    const messages = {401:'Tu sesión terminó. Vuelve a ingresar.',403:'Solo el Administrador puede ejecutar el análisis en esta copropiedad.',404:'El borrador no está disponible.',409:'Los datos cambiaron o la solicitud ya existe. Consulta el historial y vuelve a intentar.',422:'Hay datos inconsistentes o se superó el límite de 5000 registros del piloto.',503:'El servidor no está listo para guardar. Revisa la credencial privada de escritura y la conexión.',504:'El análisis tardó demasiado. Reintenta la misma solicitud.'};
    throw new Error(messages[response.status] || 'No se pudo completar la operación.');
  }
  const data = await response.json();
  if (runId && (data.id !== runId || data.project_id !== projectId || typeof data.draft !== 'string')) throw new Error('El servicio devolvió un borrador no válido.');
  if (!runId && (data.id !== requestId || data.saved !== true)) throw new Error('El servicio no confirmó el guardado. Consulta el historial antes de reintentar.');
  return data;
}
