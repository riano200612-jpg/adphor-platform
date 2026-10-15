import { PROJECTS, RESOLVED_MONTH_BASELINE, STATUS } from '../data/adphorData.js';

let refs = null;

const ESCAPE_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' };
export const escapeHtml = (value) => String(value ?? '').replace(/[&<>"'`]/g, (ch) => ESCAPE_MAP[ch]);

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
export function formatFecha(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const h = d.getHours();
  const hh = String(h % 12 || 12).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${d.getDate()} ${MESES[d.getMonth()]}, ${hh}:${mm} ${h < 12 ? 'AM' : 'PM'}`;
}

const STATUS_CLASSES = {
  [STATUS.OPEN]: 'bg-amber-50 text-amber-700 border border-amber-200',
  [STATUS.IN_PROGRESS]: 'bg-sky-50 text-sky-700 border border-sky-200',
  [STATUS.RESOLVED]: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
};
const statusClass = (estado) => STATUS_CLASSES[estado] ?? 'bg-slate-100 text-slate-700';

export function initRefs() {
  const $ = (id) => document.getElementById(id);
  refs = {
    typeBadge: $('dash-type-badge'),
    location: $('dash-location'),
    title: $('dash-project-title'),
    kpiAreas: $('kpi-areas-count'),
    kpiOpen: $('kpi-open-count'),
    kpiResolved: $('kpi-resolved-count'),
    dashAreas: $('dash-areas-grid'),
    dashMinutas: $('dash-minutas-table'),
    areasList: $('full-areas-list'),
    minutasTable: $('full-minutas-table'),
    reportName: $('report-project-name'),
    reportBreakdown: $('report-areas-breakdown'),
    areaFilter: $('filter-area'),
    statusFilter: $('filter-status'),
    searchInput: $('search-minuta'),
    modalArea: $('new-area-select'),
    userName: $('user-display-name'),
    userRole: $('user-display-role'),
    navButtons: document.querySelectorAll('[data-nav]'),
    projectSelects: document.querySelectorAll('[data-project-select]'),
  };
}

export const getRefs = () => refs;

export function setActiveTab(tabId) {
  for (const btn of refs.navButtons) {
    if (btn.dataset.nav === tabId) btn.setAttribute('aria-current', 'page');
    else btn.removeAttribute('aria-current');
  }
  for (const section of document.querySelectorAll('[data-section]')) {
    section.classList.toggle('hidden', section.dataset.section !== tabId);
  }
}

export function renderUser(user) {
  refs.userName.textContent = user.name;
  refs.userRole.textContent = user.role;
}

export function renderProjectHeader(project) {
  refs.typeBadge.textContent = project.type;
  refs.location.innerHTML = `<i class="fa-solid fa-location-dot mr-1" aria-hidden="true"></i>${escapeHtml(project.location)}`;
  refs.title.textContent = project.name;
  refs.reportName.textContent = project.name;
}

export function renderAreas(project, selectedArea = '') {
  refs.dashAreas.innerHTML = project.areas.map((area, i) => `
    <div class="p-3.5 bg-slate-50 rounded-xl border border-slate-200/70 flex items-start space-x-3">
      <div class="w-7 h-7 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5" aria-hidden="true">${i + 1}</div>
      <div>
        <h4 class="font-bold text-slate-800 text-xs">${escapeHtml(area)}</h4>
        <span class="text-[10px] text-emerald-600 font-semibold"><i class="fa-solid fa-check-circle mr-1" aria-hidden="true"></i>Área Operativa</span>
      </div>
    </div>`).join('');

  refs.areasList.innerHTML = project.areas.map((area, i) => `
    <article class="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
      <div class="flex items-center justify-between border-b border-slate-100 pb-3">
        <span class="text-xs font-bold uppercase text-sky-600">Área de Trabajo #${i + 1}</span>
        <span class="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-full">Activa</span>
      </div>
      <h3 class="font-bold text-slate-900 text-base">${escapeHtml(area)}</h3>
      <p class="text-xs text-slate-500">Supervisión técnica, asignación de personal y bitácora continua bajo la metodología ADPHOR S.A.S.</p>
    </article>`).join('');

  const options = project.areas
    .map((a) => `<option value="${escapeHtml(a)}">${escapeHtml(a)}</option>`).join('');
  refs.areaFilter.innerHTML = `<option value="">Todas las Áreas de Trabajo</option>${options}`;
  refs.areaFilter.value = project.areas.includes(selectedArea) ? selectedArea : '';
  refs.modalArea.innerHTML = options;

  refs.reportBreakdown.innerHTML = project.areas.map((a) => `
    <div class="flex items-center justify-between py-1 border-b border-slate-100">
      <span class="text-slate-700 font-medium">${escapeHtml(a)}</span>
      <span class="text-emerald-600 font-bold">100% Auditado</span>
    </div>`).join('');
}

export function renderKpis(project, minutas) {
  refs.kpiAreas.textContent = project.areas.length;
  refs.kpiOpen.textContent = minutas.filter((m) => m.estado !== STATUS.RESOLVED).length;
  refs.kpiResolved.textContent =
    minutas.filter((m) => m.estado === STATUS.RESOLVED).length + RESOLVED_MONTH_BASELINE;
}

function emptyRow(colspan, message, actionHtml = '') {
  return `
    <tr>
      <td colspan="${colspan}" class="py-10 px-6 text-center text-sm text-slate-500">
        <div class="flex flex-col items-center gap-2">
          <i class="fa-regular fa-folder-open text-2xl text-slate-300" aria-hidden="true"></i>
          <p>${escapeHtml(message)}</p>
          ${actionHtml}
        </div>
      </td>
    </tr>`;
}

export function renderRecentMinutas(minutas) {
  refs.dashMinutas.innerHTML = minutas.length
    ? minutas.slice(0, 3).map((m) => `
      <tr class="hover:bg-slate-50 transition">
        <td class="py-3 px-6 text-xs text-slate-500 font-medium whitespace-nowrap">${escapeHtml(formatFecha(m.fecha))}</td>
        <td class="py-3 px-6 text-xs font-bold text-sky-700">${escapeHtml(m.area)}</td>
        <td class="py-3 px-6 text-slate-800">${escapeHtml(m.descripcion)}</td>
        <td class="py-3 px-6 text-xs text-slate-500">${escapeHtml(m.colaborador)}</td>
        <td class="py-3 px-6"><span class="px-2 py-0.5 rounded text-xs font-bold ${statusClass(m.estado)}">${escapeHtml(m.estado)}</span></td>
      </tr>`).join('')
    : emptyRow(5, 'Aún no hay novedades registradas en esta copropiedad.');
}

export function renderMinutasTable(rows, { total }) {
  if (rows.length === 0) {
    refs.minutasTable.innerHTML = total === 0
      ? emptyRow(6, 'Aún no hay minutas registradas en esta copropiedad.')
      : emptyRow(6, 'Ninguna minuta coincide con los filtros aplicados.',
        '<button type="button" data-action="clear-filters" class="text-xs font-semibold text-sky-600 hover:underline">Limpiar filtros</button>');
    return;
  }
  refs.minutasTable.innerHTML = rows.map((m) => `
    <tr class="hover:bg-slate-50 transition">
      <td class="py-3.5 px-6">
        <div class="font-bold text-slate-900 text-xs">${escapeHtml(m.id)}</div>
        <div class="text-[11px] text-slate-400 mt-0.5">${escapeHtml(formatFecha(m.fecha))}</div>
      </td>
      <td class="py-3.5 px-6 text-xs font-bold text-sky-700 max-w-xs">${escapeHtml(m.area)}</td>
      <td class="py-3.5 px-6 text-slate-800">${escapeHtml(m.descripcion)}</td>
      <td class="py-3.5 px-6 text-xs text-slate-500">${escapeHtml(m.colaborador)}</td>
      <td class="py-3.5 px-6"><span class="px-2.5 py-1 rounded text-xs font-bold ${statusClass(m.estado)}">${escapeHtml(m.estado)}</span></td>
      <td class="py-3.5 px-6 text-right">
        <button type="button" data-action="toggle-status" data-id="${escapeHtml(m.id)}"
          class="text-xs text-sky-600 font-semibold hover:underline"
          aria-label="Cambiar estado de la minuta ${escapeHtml(m.id)}">Cambiar Estado</button>
      </td>
    </tr>`).join('');
}