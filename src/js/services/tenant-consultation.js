/** A tenant-consultation client. Request identity and tenant checks happen on backend. */
export async function fetchTenantSummary({origin, token, projectId, fetcher = fetch}) {
  if (!token) throw new Error('Debes iniciar sesión.');
  if (!/^[a-z0-9][a-z0-9-]{0,99}$/.test(projectId || '')) throw new Error('Copropiedad inválida.');
  const base = new URL(origin);
  if (base.protocol !== 'https:' && !(base.protocol === 'http:' && ['localhost','127.0.0.1'].includes(base.hostname)))
    throw new Error('El servicio de consultas no utiliza un origen seguro.');
  if (base.pathname !== '/' || base.search || base.hash || base.username || base.password)
    throw new Error('Origen de consultas inválido.');
  const url = new URL('/consultation/summary', base);
  url.search = new URLSearchParams({project_id: projectId});
  const response = await fetcher(url, {
    method: 'GET', headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(12000), cache: 'no-store', redirect: 'error', credentials: 'omit',
  });
  if (response.status === 401) throw new Error('Debes iniciar sesión nuevamente.');
  if (response.status === 403) throw new Error('No tienes permiso para consultar esta copropiedad.');
  if (response.status === 503) throw new Error('Módulo bloqueado hasta validar el aislamiento y las correspondencias.');
  if (!response.ok) throw new Error('No fue posible consultar el resumen.');
  const data = await response.json();
  const t = data?.totals;
  if (data?.project_id !== projectId || data?.source !== 'synthetic' || data?.agent_access !== false ||
      !Number.isSafeInteger(data?.record_count) || data.record_count < 0 ||
      !t || !['events','pqrs','pending'].every(k => Number.isSafeInteger(t[k]) && t[k] >= 0) ||
      t.events + t.pqrs !== data.record_count || t.pending > data.record_count)
    throw new Error('Respuesta incompatible con el entorno de pruebas.');
  return data;
}
