/**
 * Calendario piloto de Porto Castello: componente accesible sin dependencias.
 * Solo muestra y solicita cambios; las operaciones deben validarse en servidor.
 */
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
}[char]));

const priority = level => ({alto:'Alta', medio:'Media', bajo:'Baja'}[level] || 'Sin evaluar');

export function renderPortoCalendar(container, meetings, { onAction = () => {} } = {}) {
  if (!container) throw new TypeError('Se necesita un contenedor');
  const items = [...meetings].sort((a,b) => new Date(a.starts_at) - new Date(b.starts_at));
  container.classList.add('porto-calendar');
  container.innerHTML = `
    <section aria-labelledby="porto-calendar-heading">
      <header class="porto-calendar__header">
        <div><p class="porto-calendar__eyebrow">Porto Castello · Gestión gerencial</p>
        <h2 id="porto-calendar-heading">Calendario y compromisos</h2></div>
        <button type="button" data-action="new">Agendar reunión</button>
      </header>
      <p class="porto-calendar__notice" role="status">Los cambios requieren validación de conflictos en servidor. Las reuniones críticas requieren autorización.</p>
      <div class="porto-calendar__grid">
        <section aria-label="Agenda">
          <h3>Próximas reuniones</h3>
          <ol class="porto-calendar__list">
            ${items.map(item => `
              <li class="porto-calendar__meeting" data-id="${escapeHTML(item.id)}">
                <div><strong>${escapeHTML(item.title)}</strong>
                  <p><time datetime="${escapeHTML(item.starts_at)}">${escapeHTML(new Date(item.starts_at).toLocaleString('es-CO', {dateStyle:'medium',timeStyle:'short'}))}</time></p>
                  <p>Prioridad ${escapeHTML(priority(item.priority_level))}${item.requires_management ? ' · Presencia de gerencia requerida' : ''}</p>
                </div>
                <div class="porto-calendar__actions">
                  <button type="button" data-action="reschedule" data-id="${escapeHTML(item.id)}">Reprogramar</button>
                  <button type="button" data-action="cancel" data-id="${escapeHTML(item.id)}">Cancelar</button>
                </div>
              </li>`).join('') || '<li>No hay reuniones programadas.</li>'}
          </ol>
        </section>
        <aside aria-label="Matriz de criticidad">
          <h3>Criticidad gerencial</h3>
          ${['alto','medio','bajo'].map(level => `<div class="porto-calendar__priority porto-calendar__priority--${level}">
            <strong>${priority(level)}</strong>
            <span>${items.filter(item => item.priority_level === level).length} reuniones</span>
          </div>`).join('')}
        </aside>
      </div>
    </section>`;
  container.onclick = event => {
    const button = event.target.closest('button[data-action]');
    if (!button || !container.contains(button)) return;
    const meeting = items.find(item => String(item.id) === button.dataset.id);
    onAction({ action: button.dataset.action, meeting: meeting || null });
  };
}
