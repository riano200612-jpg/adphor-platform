import { PROJECTS } from '../data/adphorData.js';
import { getState, setCurrentProject, getCurrentProject } from '../core/state.js';
import { getRefs, escapeHtml } from '../ui/renderers.js';
import { showToast } from '../ui/modal.js';

export function populateProjectSelectors() {
  const html = PROJECTS.map(
    (p) => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)}</option>`,
  ).join('');
  for (const select of getRefs().projectSelects) select.innerHTML = html;
  syncProjectSelectors();
}

/** Mantiene todos los selectores (escritorio y móvil) alineados con el estado. */
export function syncProjectSelectors() {
  const { currentProjectId } = getState();
  for (const select of getRefs().projectSelects) {
    if (select.value !== currentProjectId) select.value = currentProjectId;
  }
}

export function switchProject(projectId) {
  if (projectId === getState().currentProjectId) return;
  setCurrentProject(projectId);
  showToast(`Copropiedad activada: ${getCurrentProject().name}`);
}