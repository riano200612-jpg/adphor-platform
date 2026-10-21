const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date = value => value && !Number.isNaN(Date.parse(value)) ? new Date(value).toLocaleString('es-CO', {timeZone:'America/Bogota'}) : '—';

export function historyCards(items) {
  return items.map(item => `<article class="panel"><h3>${esc(item.status)}</h3><p>Lectura de datos: ${esc(date(item.source_read_at))} · Colombia</p><p>Método: ${item.engine_kind === 'models' ? 'Modelos' : item.engine_kind === 'rules' ? 'Reglas' : 'No identificado'}</p><p>Registro: ${esc(item.id)}</p>${item.decided_at ? `<p>Decisión registrada: ${esc(date(item.decided_at))}</p>` : '<p>Requiere revisión del Administrador.</p>'}</article>`).join('');
}

export function mountAgentHistory(container, {repo, projectId, role}) {
  if (!['admin','coordinator'].includes(role)) {
    container.innerHTML = '<p class="notice">El historial está disponible para Administración y Coordinación.</p>'; return;
  }
  if (!repo.agentRuns) {
    container.innerHTML = '<p class="notice">El historial requiere una sesión conectada a Supabase.</p>'; return;
  }
  let offset = 0;
  let loading = false;
  container.innerHTML = '<section class="panel"><h2>Historial del enjambre</h2><p>Consulta el estado de las ejecuciones guardadas. Esta pantalla no ejecuta agentes ni envía informes.</p><button class="btn primary" data-history="load">Consultar historial</button></section><div data-results aria-live="polite"></div><div><button class="btn secondary" data-history="previous" disabled>Anterior</button> <button class="btn secondary" data-history="next" disabled>Siguiente</button></div>';
  container.addEventListener('click', async event => {
    const button = event.target.closest('[data-history]');
    if (!button || loading) return;
    const nextOffset = button.dataset.history === 'previous' ? Math.max(0,offset-20) : button.dataset.history === 'next' ? offset+20 : 0;
    loading = true;
    const controls = container.querySelectorAll('[data-history]');
    controls.forEach(b => b.disabled = true);
    const results = container.querySelector('[data-results]');
    results.textContent = 'Consultando historial…';
    try {
      const items = await repo.agentRuns(projectId, nextOffset);
      if (!container.isConnected) return;
      offset = nextOffset;
      results.innerHTML = items.length ? historyCards(items) : '<section class="panel"><h3>No hay ejecuciones visibles en esta página</h3><p>Los nuevos registros aparecerán cuando se conecte y ejecute el servicio de agentes.</p></section>';
      container.querySelector('[data-history="previous"]').disabled = offset === 0;
      container.querySelector('[data-history="next"]').disabled = items.length < 20;
    } catch (error) {
      if (!container.isConnected) return;
      results.textContent = error.name === 'TimeoutError' ? 'El servicio tardó demasiado. Intenta nuevamente.' : error instanceof TypeError ? 'No se pudo conectar con el servicio de asistentes.' : error.message;
    } finally {
      loading = false;
      if (container.isConnected) container.querySelector('[data-history="load"]').disabled = false;
    }
  });
}
