export const STATES = ['Pendiente', 'En proceso', 'Por verificar', 'Cerrada'];
export const PRIORITIES = ['Baja', 'Media', 'Alta', 'Urgente'];
export const ROLES = { admin: 'Administrador', coordinator: 'Coordinador', technician: 'Técnico', viewer: 'Consulta' };
export const isManager = role => ['admin', 'coordinator'].includes(role);
export const canWrite = role => isManager(role) || role === 'technician';
export const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
export const overdue = (ticket, date = today()) => ticket.status !== 'Cerrada' && ticket.due_date < date;
export function metrics(tickets) {
  const closed = tickets.filter(t => t.status === 'Cerrada').length;
  return { total: tickets.length, closed, pending: tickets.length - closed, review: tickets.filter(t => t.status === 'Por verificar').length, overdue: tickets.filter(t => overdue(t)).length, rate: tickets.length ? Math.round(closed / tickets.length * 100) : 0 };
}
export function filterTickets(tickets, filters, userId) {
  const term = (filters.search || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return tickets.filter(t => {
    const text = [t.id, t.title, t.description, t.location, t.area].join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    return (!term || text.includes(term)) && (!filters.area || t.area === filters.area) && (!filters.status || t.status === filters.status) && (!filters.priority || t.priority === filters.priority) && (!filters.mine || t.assignee === userId) && (!filters.active || t.status !== 'Cerrada') && (!filters.overdue || overdue(t));
  });
}
export function validateInput(input, project, members) {
  if (!input.title?.trim() || input.title.trim().length > 120) throw new Error('Escribe un título de máximo 120 caracteres.');
  if (!input.description?.trim() || input.description.trim().length > 2000) throw new Error('Escribe una descripción de máximo 2000 caracteres.');
  if (!input.location?.trim() || input.location.trim().length > 180) throw new Error('Indica la ubicación exacta (máximo 180 caracteres).');
  if (!project.areas.includes(input.area)) throw new Error('Selecciona un área de esta copropiedad.');
  if (!PRIORITIES.includes(input.priority)) throw new Error('Selecciona una prioridad válida.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.due_date || '') || Number.isNaN(Date.parse(input.due_date)) || input.due_date < today()) throw new Error('El plazo debe ser hoy o una fecha posterior.');
  if (!members.some(m => m.user_id === input.assignee && canWrite(m.role))) throw new Error('Selecciona un responsable de esta copropiedad.');
}
export function allowedActions(ticket, role, userId) {
  const assigned = ticket.assignee === userId;
  const operator = isManager(role) || (role === 'technician' && assigned);
  const actions = [];
  if (ticket.status !== 'Cerrada' && isManager(role)) actions.push('assign');
  if (ticket.status === 'Pendiente' && operator) actions.push('start');
  if (ticket.status === 'En proceso' && operator) actions.push('submit');
  if (ticket.status === 'Por verificar' && isManager(role)) actions.push('close', 'reopen');
  if (ticket.status === 'Cerrada' && isManager(role)) actions.push('reopen');
  if (canWrite(role) && ticket.status !== 'Cerrada') actions.push('comment');
  return actions;
}
export function applyAction(ticket, action, payload, actor, members, now = new Date().toISOString()) {
  if (!allowedActions(ticket, actor.role, actor.id).includes(action)) throw new Error('No tienes permiso para esta acción o el estado ha cambiado.');
  const note = (payload.note || '').trim();
  if (note.length > 2000) throw new Error('El comentario supera los 2000 caracteres.');
  if (['submit','close','reopen','comment'].includes(action) && !note) throw new Error('Describe la intervención, verificación u observación.');
  if (action === 'submit' && !payload.evidence?.length) throw new Error('Adjunta al menos una fotografía del resultado.');
  const next = structuredClone(ticket);
  if (action === 'assign') {
    if (!members.some(m => m.user_id === payload.assignee && canWrite(m.role))) throw new Error('El responsable no pertenece al equipo.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.due_date || '') || payload.due_date < today()) throw new Error('Selecciona un plazo válido.');
    next.assignee = payload.assignee;
    next.due_date = payload.due_date;
  }
  const states = { start: 'En proceso', submit: 'Por verificar', close: 'Cerrada', reopen: 'En proceso' };
  if (states[action]) next.status = states[action];
  next.version += 1;
  next.updated_at = now;
  next.history.push({ action, note, actor: actor.name, actor_id: actor.id, at: now, status: next.status, assignee: next.assignee, due_date: next.due_date, evidence: payload.evidence || [] });
  return next;
}
export const ACTION_LABELS = { create: 'Novedad registrada', assign: 'Asignación actualizada', start: 'Atención iniciada', submit: 'Intervención enviada a verificación', close: 'Cierre verificado', reopen: 'Caso devuelto a atención', comment: 'Observación registrada', migrated: 'Registro anterior importado' };
export function validateFiles(files) {
  if (files.length > 3) throw new Error('Puedes adjuntar hasta 3 fotografías por intervención.');
  for (const file of files) {
    if (!['image/jpeg','image/png','image/webp'].includes(file.type)) throw new Error('Solo se permiten fotografías JPG, PNG o WebP.');
    if (file.size > 2 * 1024 * 1024) throw new Error('Cada fotografía debe pesar menos de 2 MB.');
  }
}
