// Read-only cross-module briefing for the signed-in ADPHOR QA session.
// This is a deterministic Operations -> Analysis -> Reports view, NOT a trained model,
// a deployed AI swarm, or a calendar booking service.
const validStatus=new Set(['programada','en_ejecucion','completada','cancelada']);
const openPqrsStatus=new Set(['open','assigned','in_progress']);
const normalize=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const isClosed=value=>['cerrada','cerrado','closed','finalizado','finalizada'].includes(normalize(value));
const validTenant=value=>typeof value==='string'&&/^[a-z0-9][a-z0-9-]{0,99}$/.test(value);

export function isMissOperationalQuestion(question){
 const q=normalize(question).replace(/[¿?]/g,'').replace(/\s+/g,' ').trim();
 return /^(?:miss adphor,? )?(?:panorama operativo|resumen operativo|resumen de esta copropiedad|estado general de esta copropiedad|que requiere atencion en esta copropiedad|que debo revisar hoy|como va la operacion)$/.test(q);
}
function verifiedRows(rows,projectId,max=5000){
 if(!Array.isArray(rows)||rows.length>=max||rows.some(row=>!row||row.project_id!==projectId))
  throw Error('Registros fuera del alcance autorizado o incompletos.');
 return rows;
}
function finiteInstant(value){
 if(typeof value!=='string')return NaN;
 const time=Date.parse(value);
 return Number.isFinite(time)?time:NaN;
}

// Only the caller's already-authorized QA repositories may supply these rows.
// No service_role, external credentials, HTML rendering, or writes are used.
export function summarizeMissOperations({projectId,tickets,pqrs,visits,meetings,now=Date.now()}){
 if(!validTenant(projectId)||!Number.isFinite(now)||!Array.isArray(tickets)||tickets.length>5000)
  throw Error('Contexto de asistencia no verificable.');
 // The shell can hold tickets for several properties the *same user* is
 // authorized to read. They are filtered locally; never treated as a server grant.
 const scopedTickets=tickets.filter(row=>row?.project_id===projectId);
 if(scopedTickets.some(row=>typeof row.status!=='string'))throw Error('Bitácora no verificable.');
 verifiedRows(pqrs,projectId);
 verifiedRows(visits,projectId);
 verifiedRows(meetings,projectId,501);
 if(pqrs.some(row=>!openPqrsStatus.has(row.status)||typeof row.id!=='string'))
  throw Error('PQRS no verificable.');
 if(visits.some(row=>!validStatus.has(row.status)))throw Error('Visitas no verificables.');
 if(meetings.some(row=>row.is_calendar_verified!==true||row.source_status!=='Confirmada'||
   !Number.isFinite(finiteInstant(row.start_at))))
  throw Error('Reuniones no verificables.');
 const ticketsOpen=scopedTickets.filter(row=>!isClosed(row.status)).length;
 const pqrsOverdue=pqrs.filter(row=>Number.isFinite(finiteInstant(row.due_at))&&finiteInstant(row.due_at)<now).length;
 const visitsActive=visits.filter(row=>row.status==='programada'||row.status==='en_ejecucion').length;
 const meetingsNext=meetings.filter(row=>finiteInstant(row.start_at)>=now).length;
 return Object.freeze({
  projectId,
  ticketsOpen,pqrsOpen:pqrs.length,pqrsOverdue,
  visitsTotal:visits.length,visitsActive,
  verifiedMeetings:meetings.length,meetingsNext,
  engine:'rules',readonly:true,source:'supabase_qa_scoped'
 });
}

export function describeMissOperations(summary){
 if(!summary||summary.engine!=='rules'||summary.readonly!==true||summary.source!=='supabase_qa_scoped')throw Error('Resumen no verificable.');
 const observations=[];
 if(summary.pqrsOverdue>0)observations.push('revisar PQRS vencidas');
 if(summary.visitsActive>0)observations.push('consultar Visitas activas');
 if(summary.ticketsOpen>0)observations.push('revisar novedades de Bitácora');
 if(!observations.length)observations.push('mantener la revisión habitual de los módulos');
 return 'Panorama de esta copropiedad, consulta autorizada en QA: '+
  'Bitácora '+summary.ticketsOpen+' casos sin cerrar · '+
  'PQRS '+summary.pqrsOpen+' en gestión ('+summary.pqrsOverdue+' vencidas) · '+
  'Visitas '+summary.visitsTotal+' registradas ('+summary.visitsActive+' activas) · '+
  'Reuniones '+summary.verifiedMeetings+' verificadas en la importación ('+summary.meetingsNext+' próximas). '+
  'Operaciones → Análisis → Informes, mediante reglas de consulta: '+observations.join('; ')+
  '. Fuentes: registros de la sesión y Supabase QA, filtrados por copropiedad. '+
  'Las reuniones son una importación puntual, no una sincronización en vivo con Google Calendar. '+
  'Miss ADPHOR no modifica registros, aprueba decisiones ni envía comunicaciones.';
}
