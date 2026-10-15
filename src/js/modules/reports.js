import { getCurrentProject, getMinutasFor, getState } from '../core/state.js';
import { can } from './auth.js';
import { showToast } from '../ui/modal.js';
import { STATUS } from '../data/adphorData.js';

export function buildReportSummary(project, minutas) {
  const resolved = minutas.filter((m) => m.estado === STATUS.RESOLVED).length;
  return {
    project: project.name,
    areas: project.areas.length,
    total: minutas.length,
    resolved,
    pending: minutas.length - resolved,
    generatedAt: new Date(),
  };
}

/**
 * Prepara el informe y abre la impresión del navegador.
 * El usuario elige "Guardar como PDF". El original solo mostraba un aviso.
 */
export function exportReport() {
  if (!can(getState().currentUser, 'reports:export')) {
    showToast('Su perfil no tiene permiso para exportar informes.');
    return;
  }

  const summary = buildReportSummary(getCurrentProject(), getMinutasFor());
  showToast(
    `Informe de ${summary.project}: ${summary.total} minutas (${summary.resolved} resueltas). Elija “Guardar como PDF”.`,
  );

  document.body.classList.add('is-printing-report');
  const cleanup = () => {
    document.body.classList.remove('is-printing-report');
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  window.print();
}