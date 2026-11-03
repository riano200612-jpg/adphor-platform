// QA contract for staff assignment; source data remains private in Drive/DB.
// No employee names, Drive file IDs, photo URLs, emails or secrets are hardcoded.
const validId = value => typeof value === 'string' && value.trim().length > 0;
export function staffCard(member, projectId) {
  if (!validId(projectId) || member?.project_id !== projectId || member?.active !== true) return null;
  const id=member.user_id;
  if (!validId(id)) return null;
  return {
    userId:id,
    projectId,
    displayName:String(member.display_name||'Personal autorizado'),
    role:String(member.role_label||'Personal autorizado'),
    area:String(member.area||'Sin asignar'),
    canReceiveCases:member.can_receive_cases === true,
    photoPath:member.photo_approved === true ? String(member.private_photo_path||'') : '',
  };
}
export function eligibleAssignees(members,projectId,area) {
  return (members||[]).map(m=>staffCard(m,projectId))
    .filter(m=>m && m.canReceiveCases && (m.area===area || m.area==='Todas'));
}
export function assignmentRequest({projectId,caseId,assignee,area,reason}) {
  if(!validId(projectId)||!validId(caseId)||!validId(area)||typeof reason !== 'string'||!reason.trim())throw Error('Asignación incompleta');
  if(!assignee || assignee.canReceiveCases !== true || !validId(assignee.userId) || assignee.projectId !== projectId)throw Error('Responsable no autorizado');
  if(assignee.area!==area&&assignee.area!=='Todas')throw Error('Responsable fuera del área');
  // Backend MUST recheck authenticated membership/project, then persist and audit.
  return {project_id:projectId,case_id:caseId,assignee_id:assignee.userId,
          area,reason:String(reason).trim(),delivery:'none',approval:'backend_required'};
}
