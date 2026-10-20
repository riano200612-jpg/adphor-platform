import { monthlyReportView, monthlyCsvRows } from './ui-reports.js';
import '@fortawesome/fontawesome-free/css/all.min.css';
import '../css/styles.css';
import { STATES, PRIORITIES, ROLES, today, metrics, overdue, filterTickets, isManager, canWrite, allowedActions, validateInput, validateFiles, ACTION_LABELS } from './core/workflow.js';
import { createDemoRepository, DEMO_USERS } from './services/demo.js';
import { createCloudRepository } from './services/supabase.js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
const invalidConfig = Boolean(url) !== Boolean(key);
const repo = url && key ? createCloudRepository(url, key) : createDemoRepository();
const $ = id => document.getElementById(id);
const root = $('root');
const dialog = $('case-dialog');
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const icon = name => `<i class="fa-solid fa-${name}" aria-hidden="true"></i>`;
const fmt = date => date && !Number.isNaN(new Date(date).getTime()) ? new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeZone: 'America/Bogota' }).format(new Date(date.length === 10 ? `${date}T12:00:00-05:00` : date)) : '—';
const stamp = date => new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Bogota' }).format(new Date(date));
const state = { user: null, projects: [], members: [], tickets: [], projectId: '', page: 'dashboard', view: 'board', filters: {}, reportMonth: '', lastSync: null };
let busy = false;
let monthlyResult = null;
let monthlyKey = '';
const currentReportKey = () => `${state.projectId}:${state.reportMonth}`;

let toastTimer;
let modalReturnFocus;
const project = () => state.projects.find(p => p.id === state.projectId);
const team = () => state.members.filter(m => m.project_id === state.projectId);
const role = () => team().find(m => m.user_id === state.user?.id)?.role || 'viewer';
const rows = () => state.tickets.filter(t => t.project_id === state.projectId);
const person = id => state.members.find(m => m.user_id === id)?.name || 'Sin asignar';
const initials = name => name.split(' ').slice(0, 2).map(s => s[0]).join('').toUpperCase();
const option = (value, label, selected) => `<option value="${esc(value)}" ${value === selected ? 'selected' : ''}>${esc(label)}</option>`;
const badge = t => `<span class="badge status-${STATES.indexOf(t.status)}">${esc(t.status)}</span>`;
const priority = t => `<span class="priority p-${PRIORITIES.indexOf(t.priority)}">${icon('flag')} ${esc(t.priority)}</span>`;
function toast(message) { $('toast').textContent = message; $('toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').hidden = true, 6500); }
function reportError(error) { toast(error.message || 'No se pudo completar la operación.'); }
function loginScreen() {
  root.innerHTML = `<main id="main" class="login-shell"><section class="login-story"><div class="brand">${icon('building')} ADPHOR<span>S.A.S.</span></div><div><p class="eyebrow">ADMINISTRACIÓN DE PROPIEDAD HORIZONTAL</p><h1>Cada novedad,<br>en buenas manos.</h1><p>Un equipo conectado. Un responsable por tarea.<br>El mantenimiento de tus copropiedades, bajo control.</p><div class="login-steps"><span>01 · Registrar</span><span>02 · Atender</span><span>03 · Verificar</span></div></div><small>Gestión operativa · Copropiedades y áreas de trabajo</small></section><section class="login-form-wrap"><form id="login-form"><span class="app-mark">${icon('building-shield')}</span><p class="eyebrow">BIENVENIDO A ADPHOR</p><h2>Tu centro de operaciones</h2><p class="muted">${repo.mode === 'demo' ? 'Explora el flujo completo con un perfil de prueba.' : 'Ingresa con la cuenta asignada por tu administrador.'}</p>${invalidConfig ? '<p class="notice danger">La configuración del servicio está incompleta. Completa ambas variables de Supabase antes de ingresar.</p>' : repo.mode === 'demo' ? `<div class="notice"><strong>Demostración local</strong><br>Los datos se guardan solo en este navegador. Usa información y fotografías de prueba.</div><label>Perfil de demostración<select name="profile">${DEMO_USERS.map(u => option(u.id, `${u.name} · ${ROLES[u.role]}`, '')).join('')}</select></label>` : '<label>Correo o usuario<input name="email" type="text" autocomplete="username" required></label><label>Contraseña<input name="password" type="password" autocomplete="current-password" required></label>'}<p id="login-error" role="alert" class="error"></p><button class="btn primary full" ${invalidConfig ? 'disabled' : ''}>${repo.mode === 'demo' ? 'Explorar demostración' : 'Ingresar'} ${icon('arrow-right')}</button><p class="login-foot">${repo.mode === 'demo' ? 'Puedes cambiar de perfil cerrando la sesión.' : '¿Necesitas una cuenta? Contacta al administrador de tu copropiedad.'}</p></form></section></main>`;
}
async function refresh() {
  const data = await repo.load();
  Object.assign(state, data);
  if (!state.projects.some(p => p.id === state.projectId)) state.projectId = state.projects[0]?.id || '';
  state.lastSync = new Date();
}
function shell() {
  const nav = [['dashboard','chart-simple','Resumen'],['tickets','clipboard-list','Bitácora'],['mine','list-check','Mis tareas'],['areas','layer-group','Áreas'],['reports','file-lines','Informes']];
  root.innerHTML = `<div class="app-shell"><aside class="sidebar"><a class="brand" href="#" data-page="dashboard">${icon('building')} ADPHOR<span>S.A.S.</span></a><p class="sidebar-caption">CENTRO DE OPERACIONES</p><nav aria-label="Navegación principal">${nav.map(([id, i, label]) => `<button aria-label="${label}" data-page="${id}" ${state.page === id ? 'aria-current="page"' : ''}>${icon(i)}<span>${label}</span>${id === 'mine' ? `<span class="nav-count">${rows().filter(t => t.assignee === state.user.id && t.status !== 'Cerrada').length}</span>` : ''}</button>`).join('')}</nav><div class="sidebar-bottom"><div class="status-dot"></div><span>${repo.mode === 'demo' ? 'Entorno de demostración' : 'Datos compartidos'}</span><small>Gestión con trazabilidad</small></div></aside><div class="workspace"><header class="topbar"><div class="project-control"><label for="project-select">COPROPIEDAD</label><select id="project-select">${state.projects.map(p => option(p.id, p.name, state.projectId)).join('')}</select></div><div class="topbar-actions"><button class="icon-btn" data-action="refresh" aria-label="Actualizar datos" title="Actualizar datos">${icon('rotate')}</button><div class="user-chip"><span class="avatar">${esc(initials(state.user.name))}</span><div><strong>${esc(state.user.name)}</strong><small>${ROLES[role()]}</small></div></div><button class="icon-btn" data-action="logout" aria-label="Cerrar sesión" title="Cerrar sesión">${icon('arrow-right-from-bracket')}</button></div></header>${repo.mode === 'demo' ? '<div class="demo-banner">Modo demostración · Datos guardados en este navegador · Usa información de prueba</div>' : project()?.is_demo ? '<div class="demo-banner">Entorno de demostración · Nombres reales de copropiedades · Casos, áreas y responsables de ejemplo. Los registros no corresponden a la operación real.</div>' : ''}<main id="main" tabindex="-1"><div id="page-content"></div></main><footer>ADPHOR · Seguimiento de mantenimiento <span>Última lectura: ${state.lastSync?.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) || '—'}</span></footer></div></div>`;
  renderPage();
}
function heading(title, subtitle, actions = '') { return `<div class="page-heading"><div><p class="eyebrow">${esc(project()?.name || 'ADPHOR')}</p><h1>${title}</h1><p class="muted">${subtitle}</p></div><div class="heading-actions">${actions}</div></div>`; }
function newButton() { return canWrite(role()) ? `<button class="btn primary" data-action="new">${icon('plus')} Registrar novedad</button>` : ''; }
function empty(message, action = '') { return `<div class="empty">${icon('clipboard-check')}<h3>${message}</h3><p>Los registros de esta copropiedad aparecerán aquí.</p>${action}</div>`; }
function stats(list) {
  const m = metrics(list);
  return `<div class="stats">${[['pending','clock','Pendientes',m.pending,'Por atender o verificar'],['overdue','calendar-xmark','Fuera de plazo',m.overdue,'Requieren seguimiento'],['review','clipboard-check','Por verificar',m.review,'Esperando validación'],['closed','circle-check','Cerradas',m.closed,list.length ? `${m.rate}% de ${m.total} registros` : 'Sin registros']].map(([key, i, label, value, help]) => `<button class="stat" data-stat="${key}"><div><span>${label}</span>${icon(i)}</div><strong>${value}</strong><small>${help}</small></button>`).join('')}</div>`;
}
function card(t) {
  return `<button class="ticket-card" data-ticket="${esc(t.id)}"><div class="card-top">${priority(t)}<span class="ticket-id">${esc(t.id.slice(0,8))}</span></div><h3>${esc(t.title)}</h3><p class="card-area">${esc(t.area)}</p><p class="card-location">${icon('location-dot')} ${esc(t.location)}</p><div class="card-bottom"><span class="mini-user" title="${esc(person(t.assignee))}"><span class="avatar small">${esc(initials(person(t.assignee)))}</span>${esc(person(t.assignee).split(' ')[0])}</span><span class="due ${overdue(t) ? 'late' : ''}">${icon('calendar-day')} ${fmt(t.due_date)}</span></div></button>`;
}
function dashboard() {
  const list = rows();
  const urgent = list.filter(t => overdue(t) || (t.priority === 'Urgente' && t.status !== 'Cerrada')).sort((a,b) => a.due_date.localeCompare(b.due_date));
  return heading('Todo tu mantenimiento, en un lugar.', 'Organiza al equipo y acompaña cada novedad hasta su cierre.', newButton()) + stats(list) + `<div class="dashboard-grid"><section class="panel"><div class="section-heading"><div><h2>Necesitan tu atención</h2><p>Casos urgentes o fuera del plazo acordado.</p></div><span class="counter">${urgent.length}</span></div>${urgent.length ? `<div class="attention-list">${urgent.slice(0,5).map(t => `<button data-ticket="${esc(t.id)}"><span class="attention-icon">${icon('triangle-exclamation')}</span><span><strong>${esc(t.title)}</strong><small>${esc(person(t.assignee))} · ${fmt(t.due_date)}</small></span>${badge(t)}${icon('chevron-right')}</button>`).join('')}</div>` : '<div class="calm"><span>✓</span><h3>Todo al día</h3><p>No hay novedades urgentes ni vencidas en esta copropiedad.</p></div>'}</section><section class="panel progress-panel"><p class="eyebrow">TRAZABILIDAD OPERATIVA</p><h2>Del reporte a la solución</h2><div class="flow-counts">${STATES.map((s,i) => `<button data-status="${s}"><span class="step-number">0${i+1}</span><span>${s}</span><strong>${list.filter(t => t.status === s).length}</strong></button>`).join('')}</div><p class="muted">Cada cierre requiere la verificación de un coordinador.</p></section></div><section class="panel"><div class="section-heading"><div><h2>Últimas novedades</h2><p>El pulso de ${esc(project().name)}.</p></div><button class="text-btn" data-page="tickets">Ver bitácora ${icon('arrow-right')}</button></div>${list.length ? `<div class="recent-grid">${list.slice(0,3).map(card).join('')}</div>` : empty('Aún no hay novedades', newButton())}</section>`;
}
function filters() {
  const f = state.filters;
  return `<div class="filters"><label class="search-field">${icon('magnifying-glass')}<input id="search" aria-label="Buscar novedades" placeholder="Buscar por título, ubicación o ID…" value="${esc(f.search || '')}"></label><label><span class="sr-only">Área</span><select id="filter-area">${option('','Todas las áreas',f.area)}${project().areas.map(a => option(a,a,f.area)).join('')}</select></label><label><span class="sr-only">Estado</span><select id="filter-status">${option('','Todos los estados',f.status)}${STATES.map(s => option(s,s,f.status)).join('')}</select></label><label><span class="sr-only">Prioridad</span><select id="filter-priority">${option('','Todas las prioridades',f.priority)}${PRIORITIES.map(p => option(p,p,f.priority)).join('')}</select></label><button class="text-btn" data-action="clear">Limpiar</button></div>${f.overdue ? '<p class="filter-note">Mostrando únicamente casos fuera de plazo.</p>' : ''}`;
}
function ticketResults() {
  const filtered = filterTickets(rows(), { ...state.filters, mine: state.page === 'mine' }, state.user.id);
  const count = `<p class="result-count">${filtered.length} ${filtered.length === 1 ? 'novedad' : 'novedades'} · ${state.page === 'mine' ? 'Asignadas a ti' : 'Copropiedad seleccionada'}</p>`;
  if (!filtered.length) return count + empty('No hay novedades que coincidan', '<button class="btn secondary" data-action="clear">Limpiar filtros</button>');
  if (state.view === 'list') return count + `<div class="table-wrap panel"><table><thead><tr><th>Novedad</th><th>Responsable</th><th>Prioridad</th><th>Estado</th><th>Plazo</th></tr></thead><tbody>${filtered.map(t => `<tr><td><button class="table-title" data-ticket="${esc(t.id)}">${esc(t.title)}</button><small>${esc(t.area)}</small></td><td>${esc(person(t.assignee))}</td><td>${priority(t)}</td><td>${badge(t)}</td><td class="${overdue(t) ? 'late' : ''}">${fmt(t.due_date)}</td></tr>`).join('')}</tbody></table></div>`;
  return count + `<div class="kanban">${STATES.map((s,i) => { const items = filtered.filter(t => t.status === s); return `<section class="kanban-column"><h2><span class="state-dot dot-${i}"></span>${s}<span>${items.length}</span></h2><div class="kanban-cards">${items.map(card).join('') || '<p class="column-empty">Sin novedades</p>'}</div></section>`; }).join('')}</div>`;
}
function ticketsPage() { return heading(state.page === 'mine' ? 'Mis tareas' : 'Bitácora de mantenimiento', state.page === 'mine' ? 'Tu trabajo asignado, sus plazos y próximos pasos.' : 'Cada caso con responsable, evidencia y seguimiento.', newButton()) + `<div class="toolbar"><p>Selecciona una novedad para ver su detalle y avanzar.</p><div class="segmented"><button data-view="board" aria-pressed="${state.view === 'board'}">${icon('table-columns')} Tablero</button><button data-view="list" aria-pressed="${state.view === 'list'}">${icon('list')} Lista</button></div></div>` + filters() + `<div id="ticket-results">${ticketResults()}</div>`; }
function areasPage() { return heading('Áreas de trabajo', 'Prioriza el mantenimiento según los pendientes de cada área.') + `<div class="areas-grid">${project().areas.map((area,i) => { const m = metrics(rows().filter(t => t.area === area)); return `<button class="area-card" data-area="${esc(area)}"><span class="area-number">${String(i+1).padStart(2,'0')}</span><h2>${esc(area)}</h2><div><span><strong>${m.pending}</strong> pendientes</span><span class="${m.overdue ? 'late' : ''}"><strong>${m.overdue}</strong> fuera de plazo</span></div><p>Consultar bitácora ${icon('arrow-right')}</p></button>`; }).join('')}</div>`; }
function reportPage() {
  if(repo.mode === 'cloud') {
    if(!state.reportMonth) state.reportMonth=today().slice(0,7);
    const r=monthlyKey===currentReportKey()?monthlyResult:null;
    return heading('Informe mensual para la junta', 'Movimientos del período y pendientes al corte, calculados en la base de datos.', `${r?'<button class="btn secondary" data-action="csv">Descargar CSV</button><button class="btn primary" data-action="print">Imprimir / PDF</button>':''}`)
      + `<div class="report-period no-print"><label>Mes del informe<input id="report-month" type="month" max="${today().slice(0,7)}" value="${esc(state.reportMonth)}"></label><button class="btn primary" data-action="monthly-load">Generar / consultar informe</button></div>`
      + (r?monthlyReportView(r):'<section class="panel"><h2>Consulta el período</h2><p>Genera el informe para leer las cifras completas del servidor. Si falta la actualización SQL, se mostrará un aviso; no se usarán cifras parciales como informe oficial.</p></section>')
      + (r && !r.frozen && !r.is_demo && isManager(role()) && state.reportMonth<today().slice(0,7)?'<section class="panel no-print"><h3>Conservar cierre mensual</h3><p>Guarda una versión fija de las cifras y gráficas. Revisa el informe antes de cerrar: la aplicación no permite reemplazarlo.</p><button class="btn secondary" data-action="monthly-finalize">Conservar cierre de este mes</button></section>':'');
  }

  const list = rows().filter(t => !state.reportMonth || t.created_at.slice(0,7) === state.reportMonth);
  const m = metrics(list);
  return heading('Informe de seguimiento', 'Estado actual de los casos registrados en el período elegido.', `<button class="btn secondary" data-action="csv">${icon('download')} Descargar CSV</button><button class="btn primary" data-action="print">${icon('print')} Imprimir / PDF</button>`) + `<label class="report-period no-print">Mes de registro <input id="report-month" type="month" value="${esc(state.reportMonth)}"><span class="muted">Déjalo vacío para incluir todo el historial.</span></label><article class="panel printable"><div class="report-title"><div><p class="eyebrow">ADPHOR · INFORME OPERATIVO</p><h2>${esc(project().name)}</h2><p>${state.reportMonth ? `Casos registrados en ${esc(state.reportMonth)}` : 'Todos los registros'} · Generado: ${stamp(new Date())}</p></div><span class="badge">${repo.mode === 'demo' ? 'Datos de demostración' : 'Resumen de bitácora'}</span></div><div class="report-numbers"><span><strong>${m.total}</strong>Total</span><span><strong>${m.pending}</strong>Pendientes</span><span><strong>${m.closed}</strong>Cerrados</span><span><strong>${m.overdue}</strong>Fuera de plazo</span></div><div class="table-wrap"><table><thead><tr><th>Área de trabajo</th><th>Pendientes</th><th>Por verificar</th><th>Cerradas</th></tr></thead><tbody>${project().areas.map(a => { const k = metrics(list.filter(t => t.area === a)); return `<tr><td>${esc(a)}</td><td>${k.pending}</td><td>${k.review}</td><td>${k.closed}</td></tr>`; }).join('')}</tbody></table></div><p class="muted report-note">Los valores corresponden al estado actual de la bitácora. Este informe no certifica auditorías legales, financieras ni condiciones técnicas de las instalaciones.</p></article>`;
}
function renderPage() {
  if (!project()) { $('page-content').innerHTML = empty('No tienes copropiedades asignadas. Contacta al administrador.'); return; }
  $('page-content').innerHTML = ({ dashboard, tickets: ticketsPage, mine: ticketsPage, areas: areasPage, reports: reportPage }[state.page] || dashboard)();
}
function openModal(html) { modalReturnFocus = document.activeElement; dialog.innerHTML = html; dialog.showModal(); dialog.querySelector('input,select,textarea,button')?.focus(); }
function modalHeader(title, subtitle = '') { return `<header class="dialog-header"><div><p class="eyebrow">${esc(subtitle)}</p><h2 id="dialog-title">${esc(title)}</h2></div><button type="button" class="icon-btn" data-action="close-dialog" aria-label="Cerrar detalle">${icon('xmark')}</button></header>`; }
function photoInput(required = false) { return `<label>Fotografías ${required ? '(obligatorias)' : '(opcionales)'}<input name="photos" type="file" accept="image/jpeg,image/png,image/webp" multiple ${required ? 'required' : ''}><small>Hasta 3 imágenes JPG, PNG o WebP de 2 MB cada una. Evita rostros, documentos y datos privados.</small></label><div class="photo-previews"></div>`; }
function memberOptions(selected) { return team().filter(m => canWrite(m.role)).map(m => option(m.user_id,m.name,selected)).join(''); }
function newCase() {
  const own = isManager(role()) ? '' : state.user.id;
  openModal(modalHeader('Registrar novedad', project().name) + `<form id="new-case" data-request-id="${crypto.randomUUID()}"><div class="dialog-body form-grid"><label class="span-2">Título<input name="title" maxlength="120" placeholder="Ej. Fuga en tubería de la piscina" required></label><label>Área<select name="area" required><option value="">Seleccionar área</option>${project().areas.map(a => option(a,a,'')).join('')}</select></label><label>Ubicación exacta<input name="location" maxlength="180" placeholder="Ej. Cuarto de máquinas, nivel 1" required></label><label class="span-2">Descripción<textarea name="description" maxlength="2000" rows="3" placeholder="¿Qué ocurrió y qué atención se necesita?" required></textarea></label><label>Prioridad<select name="priority">${PRIORITIES.map(p => option(p,p,'Media')).join('')}</select></label><label>Plazo de atención<input name="due_date" type="date" min="${today()}" value="${today()}" required></label><label class="span-2">Responsable<select name="assignee" required ${own ? 'disabled' : ''}>${own ? option(own,state.user.name,own) : '<option value="">Asignar responsable</option>' + memberOptions('')}</select>${own ? '<small>Registras el caso a tu cargo. El coordinador puede reasignarlo.</small>' : ''}</label><div class="span-2">${photoInput()}</div><p class="notice span-2">Ante una emergencia, activa primero el protocolo de la copropiedad y contacta directamente al responsable. La bitácora no sustituye la atención urgente.</p><p class="error span-2" role="alert"></p></div><footer class="dialog-footer"><button type="button" class="btn secondary" data-action="close-dialog">Cancelar</button><button class="btn primary">Guardar novedad</button></footer></form>`);
}
async function openCase(id) {
  const t = state.tickets.find(t => t.id === id && t.project_id === state.projectId);
  if (!t) return;
  const actions = allowedActions(t, role(), state.user.id);
  const names = { assign: 'Asignar / cambiar plazo', start: 'Iniciar atención', submit: 'Enviar a verificación', close: 'Verificar y cerrar', reopen: 'Devolver a atención', comment: 'Añadir observación' };
  openModal(modalHeader(t.title, `${project().name} · ${t.id.slice(0,8)}`) + `<div class="dialog-body"><div class="detail-badges">${badge(t)}${priority(t)}${overdue(t) ? '<span class="badge danger">Fuera de plazo</span>' : ''}</div><p class="description">${esc(t.description)}</p><dl class="detail-grid"><div><dt>Área</dt><dd>${esc(t.area)}</dd></div><div><dt>Ubicación</dt><dd>${esc(t.location)}</dd></div><div><dt>Responsable</dt><dd>${esc(person(t.assignee))}</dd></div><div><dt>Plazo</dt><dd>${fmt(t.due_date)}</dd></div></dl>${actions.length ? `<section class="action-panel"><h3>Siguiente paso</h3><form id="case-action" data-id="${esc(t.id)}" data-version="${t.version}"><label>Acción<select name="action">${actions.map(a => option(a,names[a],actions[0])).join('')}</select></label><div id="action-fields"></div><p class="error" role="alert"></p><button class="btn primary">Guardar actualización</button></form></section>` : '<p class="notice">Este perfil puede consultar el caso. Las acciones disponibles dependen del responsable y del estado.</p>'}<h3 class="timeline-heading">Historial y evidencias <span>${t.history.length}</span></h3><ol class="timeline">${[...t.history].reverse().map(h => `<li><span class="timeline-dot"></span><div><strong>${esc(ACTION_LABELS[h.action] || h.action)}</strong><small>${esc(h.actor)} · ${stamp(h.at)}</small><p>${esc(h.note)}</p>${h.action === 'assign' ? `<p>Responsable: ${esc(person(h.assignee))} · Plazo: ${fmt(h.due_date)}</p>` : ''}<div class="evidence-grid">${(h.evidence || []).map(e => `<a data-evidence="${esc(e.path)}" target="_blank" rel="noopener" aria-label="Abrir fotografía ${esc(e.name)}"><span>Cargando evidencia…</span></a>`).join('')}</div></div></li>`).join('')}</ol></div>`);
  if (actions.length) actionFields(actions[0], t);
  for (const el of dialog.querySelectorAll('[data-evidence]')) {
    try { const imageUrl = await repo.imageUrl(el.dataset.evidence); if (!el.isConnected) continue; if (!imageUrl) throw new Error(); el.href = imageUrl; el.innerHTML = `<img src="${esc(imageUrl)}" alt="Evidencia de mantenimiento" loading="lazy">`; }
    catch { el.textContent = 'No se pudo cargar la foto. Cierra y vuelve a abrir el caso.'; }
  }
}
function actionFields(action, t) {
  $('action-fields').innerHTML = (action === 'assign' ? `<div class="form-grid"><label>Responsable<select name="assignee">${memberOptions(t.assignee)}</select></label><label>Plazo<input name="due_date" type="date" min="${today()}" value="${t.due_date < today() ? today() : t.due_date}" required></label></div>` : '') + `<label>${action === 'close' ? '¿Cómo verificaste que quedó solucionado?' : action === 'submit' ? 'Intervención realizada y resultado' : 'Observación'}<textarea name="note" maxlength="2000" rows="3" ${['submit','close','reopen','comment'].includes(action) ? 'required' : ''}></textarea></label>${action === 'submit' ? photoInput(true) : ''}${action === 'close' ? '<p class="notice">Confirma el resultado y revisa las evidencias antes de cerrar. La verificación quedará registrada con tu nombre.</p>' : ''}`;
}
function csvReport() {
  const list = rows().filter(t => !state.reportMonth || t.created_at.slice(0,7) === state.reportMonth);
  const cell = value => { let s = String(value ?? ''); if (/^[\s]*[=+@-]/.test(s)) s = `'${s}`; return `"${s.replace(/"/g,'""')}"`; };
  const data = repo.mode === 'cloud' && monthlyKey === currentReportKey() && monthlyResult ? monthlyCsvRows(monthlyResult) : [['ID','Título','Área','Ubicación','Responsable','Prioridad','Estado','Plazo','Registro'], ...list.map(t => [t.id,t.title,t.area,t.location,person(t.assignee),t.priority,t.status,t.due_date,t.created_at])];
  const blob = new Blob(['\ufeff' + data.map(r => r.map(cell).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `adphor-${state.projectId}-${state.reportMonth || 'historial'}.csv`; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}
async function submit(event) {
  event.preventDefault();
  if (busy) return;
  const form = event.target;
  if (!['login-form','new-case','case-action'].includes(form.id)) return;
  const errorBox = form.querySelector('.error'); errorBox.textContent = '';
  const submitBtn = form.querySelector('button:not([type="button"])');
  busy = true; submitBtn.disabled = true; const label = submitBtn.innerHTML; submitBtn.textContent = 'Guardando…';
  try {
    const input = Object.fromEntries(new FormData(form));
    if (form.id === 'login-form') {
      state.user = await repo.login(input);
      await refresh(); state.page = 'dashboard'; state.filters = {}; shell();
    } else {
      const files = [...(form.elements.photos?.files || [])]; validateFiles(files);
      const action = form.id === 'new-case' ? 'create' : input.action;
      let payload;
      if (action === 'create') {
        payload = { id: form.dataset.requestId, project_id: state.projectId, title: input.title, description: input.description, location: input.location, area: input.area, priority: input.priority, due_date: input.due_date, assignee: isManager(role()) ? input.assignee : state.user.id };
        validateInput(payload, project(), team());
      } else { payload = { id: form.dataset.id, version: Number(form.dataset.version), note: input.note || '', assignee: input.assignee, due_date: input.due_date }; }
      payload.evidence = await repo.upload(files, state.projectId, payload.id);
      const saved = await repo.save(action, payload);
      state.tickets = [saved, ...state.tickets.filter(t => t.id !== saved.id)].sort((a,b) => b.created_at.localeCompare(a.created_at));
      dialog.close(); shell(); toast(action === 'create' ? 'Novedad guardada y asignada.' : 'Actualización guardada en el historial.');
    }
  } catch(error) { errorBox.textContent = error.message || 'No se pudo guardar. Intenta nuevamente.'; }
  finally { busy = false; if (submitBtn.isConnected) { submitBtn.disabled = false; submitBtn.innerHTML = label; } }
}
document.addEventListener('submit', submit);
document.addEventListener('click', async event => {
  const el = event.target.closest('button,a[data-page]'); if (!el || busy) return;
  try {
    if (el.dataset.page) { event.preventDefault(); state.page = el.dataset.page; state.filters = {}; shell(); return; }
    if (el.dataset.ticket) { await openCase(el.dataset.ticket); return; }
    if (el.dataset.view) { state.view = el.dataset.view; renderPage(); return; }
    if (el.dataset.area) { state.page = 'tickets'; state.filters = { area: el.dataset.area }; shell(); return; }
    if (el.dataset.status) { state.page = 'tickets'; state.filters = { status: el.dataset.status }; shell(); return; }
    if (el.dataset.stat) { state.page = 'tickets'; state.filters = el.dataset.stat === 'overdue' ? { overdue: true } : el.dataset.stat === 'review' ? { status: 'Por verificar' } : el.dataset.stat === 'closed' ? { status: 'Cerrada' } : { active: true }; shell(); return; }
    switch(el.dataset.action) {
      case 'new': newCase(); break;
      case 'close-dialog': dialog.close(); break;
      case 'clear': state.filters = {}; renderPage(); break;
      case 'refresh': el.disabled = true; try { await refresh(); shell(); toast('Datos actualizados.'); } finally { el.disabled = false; } break;
      case 'logout': monthlyResult=null; monthlyKey=''; await repo.logout(); state.user = null; state.projects = []; state.tickets = []; state.members = []; state.projectId = ''; loginScreen(); break;
      case 'monthly-load':
      case 'monthly-finalize': {
        const projectId=state.projectId, month=state.reportMonth, requestKey=currentReportKey();
        busy=true; el.disabled=true;
        try {
          const result=await repo.monthlyReport(projectId,month,el.dataset.action==='monthly-finalize');
          if(requestKey===currentReportKey()) { monthlyResult=result; monthlyKey=requestKey; renderPage(); }
        } catch(error) {
          monthlyResult=null; monthlyKey=''; renderPage();
          throw new Error(/function|schema cache|PGRST202/.test(error.message) ? 'Falta aplicar la actualización SQL de informes mensuales en Supabase. Los casos existentes siguen guardados.' : error.message);
        } finally { busy=false; if(el.isConnected) el.disabled=false; }
        break;
      }
      case 'csv': csvReport(); break;
      case 'print': window.print(); break;
    }
  } catch(error) { reportError(error); }
});
document.addEventListener('change', event => {
  const el = event.target;
  if (el.id === 'project-select') { state.projectId = el.value; state.filters = {}; shell(); }
  if (el.id.startsWith('filter-')) { state.filters[el.id.replace('filter-','')] = el.value; $('ticket-results').innerHTML = ticketResults(); }
  if (el.id === 'report-month') { state.reportMonth = el.value; renderPage(); }
  if (el.name === 'action') actionFields(el.value, state.tickets.find(t => t.id === el.form.dataset.id));
  if (el.name === 'photos') {
    const previews = el.closest('label').nextElementSibling;
    previews.querySelectorAll('img').forEach(img => URL.revokeObjectURL(img.src)); previews.innerHTML = '';
    try { validateFiles([...el.files]); [...el.files].forEach(file => { const img = document.createElement('img'); img.src = URL.createObjectURL(file); img.alt = file.name; img.onload = () => URL.revokeObjectURL(img.src); previews.append(img); }); }
    catch(error) { el.value = ''; toast(error.message); }
  }
});
document.addEventListener('input', event => { if(event.target.id === 'search') { state.filters.search = event.target.value; $('ticket-results').innerHTML = ticketResults(); } });
dialog.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
dialog.addEventListener('close', () => { modalReturnFocus?.focus(); });
window.addEventListener('offline', () => toast('Sin conexión. Conserva el formulario; podrás volver a intentar el guardado.'));
window.addEventListener('storage', event => { if(event.key === 'adphor.workflow.demo.v3' && state.user) toast('La bitácora cambió en otra pestaña. Pulsa Actualizar para consultar los cambios.'); });
loginScreen();
