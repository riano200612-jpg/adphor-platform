/** Additional presentation guard; PostgreSQL RLS remains the security boundary. */
export function assignedProjects(projects, memberships, userId) {
  if (!userId) return [];
  const eligible=new Set((memberships||[])
    .filter(m=>m.user_id===userId && typeof m.project_id==='string')
    .map(m=>m.project_id));
  return (projects||[]).filter(p=>eligible.has(p.id));
}
export function assignedMembers(memberships, userId, projects) {
  const ids=new Set(assignedProjects(projects,memberships,userId).map(p=>p.id));
  return (memberships||[]).filter(m=>ids.has(m.project_id));
}
export function assignedTickets(tickets, userId, memberships, projects) {
  const ids=new Set(assignedProjects(projects,memberships,userId).map(p=>p.id));
  return (tickets||[]).filter(t=>ids.has(t.project_id));
}
