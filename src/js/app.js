import '@fortawesome/fontawesome-free/css/all.min.css';
import '../css/styles.css';
import { getState, subscribe, getCurrentProject, getMinutasFor } from './core/state.js';
import {
  initRefs, renderProjectHeader, renderAreas, renderKpis,
  renderRecentMinutas, renderUser, setActiveTab,
} from './ui/renderers.js';
import { initAuth, logout } from './modules/auth.js';
import { populateProjectSelectors, syncProjectSelectors, switchProject } from './modules/projects.js';
import {
  bindMinutaFilters, clearFilters, openMinutaModal, closeMinutaModal,
  submitMinuta, toggleMinutaStatus, renderFilteredTable,
} from './modules/minutas.js';
import { exportReport } from './modules/reports.js';

let prev = null;

/** Render incremental: solo actualiza lo que cambió en el estado. */
function onStateChange(state) {
  const project = getCurrentProject();
  const minutas = getMinutasFor(state.currentProjectId);

  const projectChanged = prev?.currentProjectId !== state.currentProjectId;
  const minutasChanged = projectChanged || prev?.minutasDb !== state.minutasDb;
  const filtersChanged = minutasChanged || prev?.filters !== state.filters;

  if (projectChanged) {
    renderProjectHeader(project);
    renderAreas(project, state.filters.area);
    syncProjectSelectors();
  }
  if (minutasChanged) {
    renderKpis(project, minutas);
    renderRecentMinutas(minutas);
  }
  if (filtersChanged) renderFilteredTable();

  prev = {
    currentProjectId: state.currentProjectId,
    minutasDb: state.minutasDb,
    filters: state.filters,
  };
}

/** Delegación de eventos: un único listener para toda la aplicación. */
function handleClick(event) {
  const tabEl = event.target.closest('[data-tab]');
  if (tabEl) {
    setActiveTab(tabEl.dataset.tab);
    return;
  }
  const actionEl = event.target.closest('[data-action]');
  if (!actionEl) return;

  switch (actionEl.dataset.action) {
    case 'open-minuta': return openMinutaModal();
    case 'close-minuta': return closeMinutaModal();
    case 'logout': return logout();
    case 'export-report': return exportReport();
    case 'clear-filters': return clearFilters();
    case 'toggle-status': return toggleMinutaStatus(actionEl.dataset.id);
  }
}

function handleChange(event) {
  if (event.target.matches('[data-project-select]')) switchProject(event.target.value);
}

function init() {
  initRefs();
  populateProjectSelectors();
  bindMinutaFilters();
  initAuth({ onLogin: renderUser });

  document.getElementById('new-minuta-form').addEventListener('submit', submitMinuta);
  document.addEventListener('click', handleClick);
  document.addEventListener('change', handleChange);

  subscribe(onStateChange);
  setActiveTab('dashboard');
  onStateChange(getState());
}

init();