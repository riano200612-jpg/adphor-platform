const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date = value => value && !Number.isNaN(Date.parse(value)) ? new Date(value).toLocaleString('es-CO', {timeZone:'America/Bogota'}) : '—';

export function historyCards(items) {
  return items.map(item => `<article class="panel"><h3>${esc(item.status)}</h3><p>Lectura de datos: ${esc(date(item.source_read_at))} · Colombia</p><p>Método: ${item.engine_kind === 'models' ? 'Modelos' : item.engine_kind === 'rules' ? 'Reglas' : 'No identificado'}</p><p>Registro: ${esc(item.id)}</p>${item.decided_at ? `<p>Decisión registrada: ${esc(date(item.decided_at))}</p>` : '<p>Requiere revisión del Administrador.</p>'}<button class="btn secondary" data-history="detail" data-run-id="${esc(item.id)}">Ver borrador</button></article>`).join('');
}

export function draftCard(item, canReview = false) {
  return `<article class="panel"><h3>${esc(item.status)}</h3><p>Lectura: ${esc(date(item.source_read_at))} · Colombia</p><pre style="white-space:pre-wrap;overflow-wrap:anywhere;font-family:inherit">${esc(item.draft)}</pre>${item.decided_at ? `<p>Decisión registrada: ${esc(date(item.decided_at))} · Colombia</p><p>Administrador: ${esc(item.administrator_id)}</p><p>Observaciones: ${esc(item.note || 'Sin observaciones')}</p><p>La decisión corresponde a esta versión; el texto original del borrador se conserva.</p>` : canReview ? `<section><label for="agent-review-note">Observaciones del Administrador (máximo 4000 caracteres)</label><textarea id="agent-review-note" data-review-note maxlength="4000" rows="3" style="width:100%"></textarea><p>La decisión es definitiva para esta versión. No envía el informe ni cierra casos.</p><button class="btn primary" data-history="approve">Aprobar borrador</button> <button class="btn secondary" data-history="reject">Rechazar borrador</button><p data-review-feedback role="status"></p></section>` : ''}<p>Consultar este documento no lo aprueba ni lo envía.</p></article>`;
}

export function mountAgentHistory(container, {repo, projectId, role}) {
  if (!['admin','coordinator'].includes(role)) {
    container.innerHTML = '<p class="notice">El historial está disponible para Administración y Coordinación.</p>'; return;
  }
  if (!repo.agentRuns) {
    container.innerHTML = '<p class="notice">El historial requiere una sesión conectada a Supabase.</p>'; return;
  }
  let currentDraft = null;
  const canReview = role === 'admin' && typeof repo.reviewAgentRun === 'function';
  const renderDraft = item => {
    currentDraft = item;
    return draftCard(item, canReview && item.status === 'Pendiente de aprobación del administrador');
  };
  let offset = 0;
  let loading = false;
  let requestId = null;
  let hasNext = false;
  container.innerHTML = `<section class="panel"><h2>Historial del enjambre</h2><p>Análisis por reglas: identifica vencidos, asignaciones pendientes y problemas de datos. Los modelos de IA todavía no están activados.</p><p>Cada ejecución guarda un borrador pendiente de aprobación. No cierra casos ni envía informes.</p><button class="btn secondary" data-history="load">Consultar historial</button> ${role === 'admin' && repo.runAgentRules ? '<button class="btn primary" data-history="run">Ejecutar análisis por reglas</button>' : ''}</section><div data-results aria-live="polite"></div><div><button class="btn secondary" data-history="previous" disabled>Anterior</button> <button class="btn secondary" data-history="next" disabled>Siguiente</button></div>`;
  container.addEventListener('click', async event => {
    const button = event.target.closest('[data-history]');
    if (!button || loading) return;
    if (['approve','reject'].includes(button.dataset.history)) {
      if (!canReview || !currentDraft || currentDraft.decided_at) return;
      const decision = button.dataset.history === 'approve' ? 'approved' : 'rejected';
      const note = container.querySelector('[data-review-note]').value;
      if (!window.confirm(`¿Confirmas ${decision === 'approved' ? 'aprobar' : 'rechazar'} este borrador leído el ${date(currentDraft.source_read_at)}? La decisión es definitiva para esta versión y no envía informes ni cierra casos.`)) return;
      loading = true;
      container.querySelectorAll('[data-history]').forEach(b => b.disabled = true);
      const feedback = container.querySelector('[data-review-feedback]');
      feedback.textContent = 'Registrando tu decisión…';
      try {
        const review = await repo.reviewAgentRun(projectId, currentDraft.id, currentDraft.result_hash, decision, note);
        if (!container.isConnected) return;
        const item = {...currentDraft, ...review, status: decision === 'approved' ? 'Aprobado por el administrador' : 'Rechazado por el administrador'};
        container.querySelector('[data-results]').innerHTML = renderDraft(item);
      } catch (error) {
        if (container.isConnected) feedback.textContent = error.message;
      } finally {
        loading = false;
        if (container.isConnected) {
          container.querySelectorAll('[data-history]').forEach(b => b.disabled = false);
          container.querySelector('[data-history="previous"]').disabled = offset === 0;
          container.querySelector('[data-history="next"]').disabled = !hasNext;
        }
      }
      return;
    }
    const nextOffset = button.dataset.history === 'previous' ? Math.max(0,offset-20) : button.dataset.history === 'next' ? offset+20 : 0;
    loading = true;
    const controls = container.querySelectorAll('[data-history]');
    controls.forEach(b => b.disabled = true);
    const results = container.querySelector('[data-results]');
    results.textContent = button.dataset.history === 'run' ? 'Analizando datos y guardando el borrador…' : 'Consultando…';
    try {
      if (button.dataset.history === 'run') {
        requestId ||= crypto.randomUUID();
        const saved = await repo.runAgentRules(projectId, requestId);
        requestId = null;
        if (!container.isConnected) return;
        const item = await repo.agentRunDetail(projectId, saved.id);
        if (container.isConnected) results.innerHTML = '<p class="notice">Borrador guardado. Requiere aprobación del Administrador.</p>' + renderDraft(item);
        return;
      }
      if (button.dataset.history === 'detail') {
        const item = await repo.agentRunDetail(projectId, button.dataset.runId);
        if (container.isConnected) results.innerHTML = renderDraft(item);
        return;
      }
      const items = await repo.agentRuns(projectId, nextOffset);
      if (!container.isConnected) return;
      offset = nextOffset;
      hasNext = items.length === 20;
      results.innerHTML = items.length ? historyCards(items) : '<section class="panel"><h3>No hay ejecuciones visibles en esta página</h3><p>Los nuevos registros aparecerán cuando se conecte y ejecute el servicio de agentes.</p></section>';
      container.querySelector('[data-history="previous"]').disabled = offset === 0;
      container.querySelector('[data-history="next"]').disabled = items.length < 20;
    } catch (error) {
      if (!container.isConnected) return;
      results.textContent = error.name === 'TimeoutError' ? 'El servicio tardó demasiado. Intenta nuevamente.' : error instanceof TypeError ? 'No se pudo conectar con el servicio de asistentes.' : error.message;
    } finally {
      loading = false;
      if (container.isConnected) {
        container.querySelectorAll('[data-history]').forEach(b => b.disabled = false);
        container.querySelector('[data-history="previous"]').disabled = offset === 0;
        container.querySelector('[data-history="next"]').disabled = !hasNext;
      }
    }
  });
}
