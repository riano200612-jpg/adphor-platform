/** Reglas UI orientativas: el backend DEBE repetirlas bajo transacción. */
export function meetingGate({start, now=new Date(), action='create', isCritical=false, hasApproval=false, conflicts=[]}) {
  const at = new Date(start), clock = new Date(now);
  if(!Number.isFinite(at.getTime()) || !Number.isFinite(clock.getTime())) return {allowed:false,reason:'Fecha inválida'};
  if(at <= clock) return {allowed:false,reason:'No es posible programar reuniones en el pasado'};
  if(conflicts.length) return {allowed:false,reason:'Conflicto de agenda',suggestAlternatives:true};
  const within24h = at.getTime()-clock.getTime() < 24*60*60*1000;
  if(within24h && !hasApproval) return {allowed:false,reason:'Solicitar excepción de último momento a Gerencia',requestException:true};
  if(action!=='create' && isCritical && !hasApproval) return {allowed:false,reason:'La reunión crítica requiere autorización superior',requestException:true};
  return {allowed:true};
}
export function formatManagementAlert(request) {
  return {
    type:'meeting_exception',status:'pending',project_id:request.project_id,
    meeting_id:request.meeting_id ?? null,requested_by:request.requested_by,
    requested_slot:request.requested_slot,reason:request.reason,
  };
}
