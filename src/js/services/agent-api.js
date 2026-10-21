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
