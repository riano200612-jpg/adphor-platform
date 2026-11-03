/** Read-only UI. It never renders raw rows, tenant IDs from other records or private data. */
export function mountTenantConsultation(container, {repo, projectId}) {
  container.innerHTML = `<section class="panel"><h2>Consulta por copropiedad · Pruebas</h2>
  <p>Acceso restringido a datos sintéticos. No consume Drive, los agentes ni los tickets reales.</p>
  <button type="button" class="btn secondary" data-tenant-load>Ver resumen sintético</button>
  <p data-tenant-result role="status" aria-live="polite"></p></section>`;
  const button = container.querySelector('[data-tenant-load]');
  const result = container.querySelector('[data-tenant-result]');
  if (!repo || typeof repo.consultationSummary !== 'function') {
    button.disabled = true;
    result.textContent = 'Este entorno no tiene el servicio de consulta disponible.';
    return;
  }
  button.addEventListener('click', async () => {
    button.disabled = true;
    result.textContent = 'Verificando permisos y leyendo datos de prueba…';
    try {
      const data = await repo.consultationSummary(projectId);
      if (!container.isConnected) return;
      // Use textContent to avoid cell content HTML injection.
      result.textContent = `Datos sintéticos: ${data.record_count} · Reuniones: ${data.totals.events} · PQRS: ${data.totals.pqrs} · Pendientes: ${data.totals.pending}. El enjambre sigue deshabilitado.`;
    } catch (error) {
      if (container.isConnected) result.textContent = error.message || 'Consulta no disponible.';
    } finally { if (container.isConnected) button.disabled = false; }
  });
}
