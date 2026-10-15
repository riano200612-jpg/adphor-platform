import { PROJECTS, SEED_MINUTAS, STATUS } from '../data/adphorData.js';

const STORAGE_KEY = 'adphor.minutas.v1';
const STATUS_CYCLE = [STATUS.OPEN, STATUS.IN_PROGRESS, STATUS.RESOLVED];
const VALID_STATUS = new Set(Object.values(STATUS));
const listeners = new Set();

const state = {
  currentProjectId: PROJECTS[0].id,
  currentUser: null,
  minutasDb: loadMinutas(),
  filters: { search: '', area: '', status: '' },
};

export const getState = () => state;
export const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
export const getCurrentProject = () =>
  PROJECTS.find((p) => p.id === state.currentProjectId) ?? PROJECTS[0];
export const getMinutasFor = (projectId = state.currentProjectId) =>
  state.minutasDb[projectId] ?? [];

function commit(patch) {
  Object.assign(state, patch);
  for (const listener of listeners) {
    try {
      listener(state);
    } catch (err) {
      console.error('[ADPHOR] Error al renderizar:', err);
    }
  }
}

function persist(minutasDb) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(minutasDb));
    return true;
  } catch (err) {
    console.warn('[ADPHOR] No se pudo guardar la bitácora:', err);
    return false;
  }
}

export function setCurrentProject(projectId) {
  if (projectId === state.currentProjectId || !PROJECTS.some((p) => p.id === projectId)) return;
  // Un filtro de área pertenece a una copropiedad: se limpia al cambiar.
  commit({ currentProjectId: projectId, filters: { ...state.filters, area: '' } });
}

export function setCurrentUser(user) {
  commit({ currentUser: user });
}

export function setFilters(patch) {
  commit({ filters: { ...state.filters, ...patch } });
}

export function addMinuta({ area, descripcion }) {
  const projectId = state.currentProjectId;
  const minuta = {
    id: nextMinutaId(),
    fecha: new Date().toISOString(),
    area,
    descripcion,
    colaborador: state.currentUser?.name ?? 'Sin asignar',
    estado: STATUS.OPEN,
  };
  const minutasDb = { ...state.minutasDb, [projectId]: [minuta, ...getMinutasFor(projectId)] };
  const persisted = persist(minutasDb);
  commit({ minutasDb });
  return { minuta, persisted };
}

export function cycleMinutaStatus(id) {
  const projectId = state.currentProjectId;
  let updated = null;
  const list = getMinutasFor(projectId).map((m) => {
    if (m.id !== id) return m;
    const next = STATUS_CYCLE[(STATUS_CYCLE.indexOf(m.estado) + 1) % STATUS_CYCLE.length];
    updated = { ...m, estado: next };
    return updated;
  });
  if (!updated) return null;
  const minutasDb = { ...state.minutasDb, [projectId]: list };
  persist(minutasDb);
  commit({ minutasDb });
  return updated;
}

function nextMinutaId() {
  let max = 0;
  for (const list of Object.values(state.minutasDb)) {
    for (const m of list) {
      const n = Number(String(m.id).replace('MIN-', ''));
      if (Number.isFinite(n) && n > max) max = n;
    }
  }
  return `MIN-${max + 1}`;
}

function isValidDb(db) {
  return Boolean(db) && typeof db === 'object' && !Array.isArray(db) &&
    Object.values(db).every((list) =>
      Array.isArray(list) &&
      list.every((m) => m && typeof m.id === 'string' && VALID_STATUS.has(m.estado)));
}

function loadMinutas() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (isValidDb(parsed)) return parsed;
    }
  } catch (err) {
    console.warn('[ADPHOR] Bitácora local inválida; se usan datos semilla.', err);
  }
  return structuredClone(SEED_MINUTAS);
}

// Sincronización entre pestañas abiertas
window.addEventListener('storage', (event) => {
  if (event.key !== STORAGE_KEY || !event.newValue) return;
  try {
    const parsed = JSON.parse(event.newValue);
    if (isValidDb(parsed)) commit({ minutasDb: parsed });
  } catch {
    /* valor corrupto: se ignora */
  }
});