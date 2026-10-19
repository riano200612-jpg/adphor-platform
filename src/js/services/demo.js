import { PROJECTS, SEED_MINUTAS } from '../data/adphorData.js';
import { applyAction, validateInput, canWrite, isManager } from '../core/workflow.js';
const KEY = 'adphor.workflow.demo.v3';
export const DEMO_USERS = [
  { id: 'admin-demo', name: 'Administración demo', role: 'admin' },
  { id: 'coordinator-demo', name: 'Coordinación demo', role: 'coordinator' },
  { id: 'tecnico', name: 'Técnico de demostración', role: 'technician' },
  { id: 'viewer-demo', name: 'Consejo · demostración', role: 'viewer' },
];
function memberships() {
  return PROJECTS.flatMap(p => DEMO_USERS.filter(u => ['admin','coordinator'].includes(u.role) || p.id === PROJECTS[0].id).map(u => ({ project_id: p.id, user_id: u.id, role: u.role, name: u.name })));
}
function initial() {
  const source = SEED_MINUTAS;
  return Object.entries(source).flatMap(([project_id, rows]) => (Array.isArray(rows) ? rows : []).filter(m => m && typeof m.descripcion === 'string').map(m => ({
    id: m.id || crypto.randomUUID(), project_id, title: m.descripcion.slice(0, 100), description: m.descripcion,
    area: m.area || '', location: 'Ubicación pendiente de precisar', priority: 'Media', assignee: 'coordinator-demo',
    due_date: (m.fecha || new Date().toISOString()).slice(0,10), status: m.estado === 'Resuelta' ? 'Por verificar' : m.estado === 'En Proceso' ? 'En proceso' : 'Pendiente',
    created_at: m.fecha || new Date().toISOString(), updated_at: m.fecha || new Date().toISOString(), version: 1,
    history: [{ action: 'migrated', actor: 'Migración de bitácora', at: new Date().toISOString(), note: `Registro anterior: ${m.estado}. ${m.colaborador || ''}. Los cierres anteriores requieren verificación.`, evidence: [] }],
  })));
}
function read() {
  const raw = localStorage.getItem(KEY);
  if (!raw) return initial();
  const rows = JSON.parse(raw);
  if (!Array.isArray(rows) || rows.some(t => !t.id || !Array.isArray(t.history))) throw new Error('La bitácora local no es válida. Conserva los datos del navegador y solicita soporte.');
  return rows;
}
function persist(rows) {
  try { localStorage.setItem(KEY, JSON.stringify(rows)); }
  catch { throw new Error('No se pudo guardar: el almacenamiento local está lleno o bloqueado. Reduce las fotos y vuelve a intentar. El formulario se conserva.'); }
}
export function createDemoRepository() {
  let user = null;
  const members = memberships();
  return {
    mode: 'demo',
    async login({ profile }) { user = DEMO_USERS.find(u => u.id === profile); if (!user) throw new Error('Selecciona un perfil.'); return user; },
    async logout() { user = null; },
    async load() {
      if (!user) throw new Error('Inicia sesión.');
      const ids = members.filter(m => m.user_id === user.id).map(m => m.project_id);
      return { projects: PROJECTS.filter(p => ids.includes(p.id)), members: members.filter(m => ids.includes(m.project_id)), tickets: read().filter(t => ids.includes(t.project_id)) };
    },
    async save(action, payload) {
      if (!user) throw new Error('Inicia sesión.');
      const run = async () => {
        const rows = read();
        const ticket = rows.find(t => t.id === payload.id);
        const projectId = action === 'create' ? payload.project_id : ticket?.project_id;
        const member = members.find(m => m.user_id === user.id && m.project_id === projectId);
        if (!member) throw new Error('No tienes acceso a esta copropiedad.');
        let saved;
        if (action === 'create') {
          if (ticket) return ticket; // stable request id makes a retry idempotent
          if (!canWrite(member.role)) throw new Error('Este perfil solo puede consultar.');
          if (!isManager(member.role) && payload.assignee !== user.id) throw new Error('Solo un coordinador puede asignar a otra persona.');
          validateInput(payload, PROJECTS.find(p => p.id === projectId), members.filter(m => m.project_id === projectId));
          const at = new Date().toISOString();
          saved = { ...payload, title: payload.title.trim(), description: payload.description.trim(), location: payload.location.trim(), status: 'Pendiente', version: 1, created_at: at, updated_at: at, history: [{ action: 'create', actor: user.name, actor_id: user.id, at, note: payload.description.trim(), evidence: payload.evidence || [] }] };
          delete saved.evidence;
          rows.unshift(saved);
        } else {
          if (ticket.version !== payload.version) throw new Error('Otra persona actualizó el caso. Cierra el detalle, actualiza la lista y revisa los cambios.');
          saved = applyAction(ticket, action, payload, { ...user, role: member.role }, members.filter(m => m.project_id === projectId));
          rows[rows.findIndex(t => t.id === saved.id)] = saved;
        }
        persist(rows);
        return saved;
      };
      return navigator.locks ? navigator.locks.request(KEY, run) : run();
    },
    async upload(files) {
      return Promise.all(files.map(file => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve({ name: file.name, path: reader.result });
        reader.onerror = () => reject(new Error('No se pudo leer la fotografía.'));
        reader.readAsDataURL(file);
      })));
    },
    async imageUrl(path) { return /^data:image\/(png|jpeg|webp);base64,/.test(path) ? path : ''; },
  };
}
