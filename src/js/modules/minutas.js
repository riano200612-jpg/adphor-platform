import {
  addMinuta, cycleMinutaStatus, getCurrentProject, getMinutasFor, getState, setFilters,
} from '../core/state.js';
import { getRefs, renderMinutasTable } from '../ui/renderers.js';
import { closeDialog, openDialog, showToast } from '../ui/modal.js';

const MAX_LENGTH = 1000;
const SEARCH_DEBOUNCE_MS = 150;

export function filterMinutas(list, { search = '', area = '', status = '' }) {
  const term = search.trim().toLowerCase();
  return list.filter((m) =>
    (!term || m.descripcion.toLowerCase().includes(term) || m.id.toLowerCase().includes(term)) &&
    (!area || m.area === area) &&
    (!status || m.estado === status));
}

export function renderFilteredTable() {
  const all = getMinutasFor();
  renderMinutasTable(filterMinutas(all, getState().filters), { total: all.length });
}

export function bindMinutaFilters() {
  const refs = getRefs();
  let timer;
  refs.searchInput.addEventListener('input', (e) => {
    clearTimeout(timer);
    timer = setTimeout(() => setFilters({ search: e.target.value }), SEARCH_DEBOUNCE_MS);
  });
  refs.areaFilter.addEventListener('change', (e) => setFilters({ area: e.target.value }));
  refs.statusFilter.addEventListener('change', (e) => setFilters({ status: e.target.value }));
}

export function clearFilters() {
  const refs = getRefs();
  refs.searchInput.value = '';
  refs.areaFilter.value = '';
  refs.statusFilter.value = '';
  setFilters({ search: '', area: '', status: '' });
}

export function openMinutaModal() {
  openDialog(document.getElementById('minuta-modal'), { initialFocus: getRefs().modalArea });
}

export function closeMinutaModal() {
  closeDialog(document.getElementById('minuta-modal'));
  document.getElementById('new-minuta-form').reset();
}

export function submitMinuta(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const area = form.elements.area.value;
  const descripcion = form.elements.descripcion.value.trim();

  const valid = getCurrentProject().areas.includes(area) &&
    descripcion.length > 0 && descripcion.length <= MAX_LENGTH;
  if (!valid) {
    showToast('Revise el área y la descripción (máximo 1000 caracteres).');
    return;
  }

  const { persisted } = addMinuta({ area, descripcion });
  closeMinutaModal();
  showToast(persisted
    ? 'Minuta guardada en la bitácora del área.'
    : 'Minuta guardada solo en esta sesión: el almacenamiento del navegador no está disponible.');
}

export function toggleMinutaStatus(id) {
  const updated = cycleMinutaStatus(id);
  if (updated) showToast(`Estado de la minuta ${id} actualizado a “${updated.estado}”.`);
}