import {calendarInstant} from './calendar-availability.js';

// Validated, read-only QA summaries. The caller must use the currently signed-in
// Supabase session; this module does not implement authorization or remote fetch.
const normalize=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const allowed=new Set(['open','assigned','in_progress']);
const maxRows=5000;
export function isMissPqrsStatusQuestion(question){
 const q=normalize(question).replace(/[¿?]/g,'').replace(/\s+/g,' ').trim();
 return /^(?:miss adphor,? )?(?:pqrs pendientes|mis pqrs pendientes|casos pqrs pendientes|estado de (?:las |mis )?pqrs|cuantas pqrs (?:hay )?pendientes(?: en esta copropiedad)?|cuantas pqrs pendientes tiene esta copropiedad|que pqrs (?:hay pendientes|requieren atencion)|cuantas solicitudes pqrs estan abiertas)$/.test(q);
}
export function summarizeMissPqrsStatus(rows,projectId,now=Date.now()){
 if(typeof projectId!=='string'||!projectId.trim()||!Array.isArray(rows)||rows.length>=maxRows||!Number.isFinite(now))
  throw Error('Consulta PQRS no verificable.');
 const ids=new Set();
 let open=0,assigned=0,inProgress=0,overdue=0,withoutDate=0;
 for(const row of rows){
  if(!row||row.project_id!==projectId||typeof row.id!=='string'||!row.id.trim()||
     ids.has(row.id)||!allowed.has(row.status))
   throw Error('Registros PQRS fuera del alcance autorizado o duplicados.');
  ids.add(row.id);
  if(row.status==='open')open++;
  if(row.status==='assigned')assigned++;
  if(row.status==='in_progress')inProgress++;
  if(row.due_at==null||row.due_at===''){withoutDate++;continue;}
  const deadline=calendarInstant(row.due_at);
  if(!Number.isFinite(deadline))throw Error('Fecha de vencimiento PQRS no verificable.');
  if(deadline<now)overdue++;
 }
 return Object.freeze({total:rows.length,open,assigned,inProgress,overdue,withoutDate,source:'supabase_qa_scoped'});
}
export function describeMissPqrsStatus(summary){
 if(!summary||summary.source!=='supabase_qa_scoped'||!Number.isSafeInteger(summary.total)||
   summary.total!==summary.open+summary.assigned+summary.inProgress||
   [summary.open,summary.assigned,summary.inProgress,summary.overdue,summary.withoutDate].some(n=>!Number.isSafeInteger(n)||n<0))
  throw Error('Resumen PQRS no verificable.');
 return 'PQRS de esta copropiedad en Supabase QA: '+summary.total+' en gestión · '+
  summary.open+' abiertas · '+summary.assigned+' asignadas · '+summary.inProgress+
  ' en progreso · '+summary.overdue+' vencidas'+
  (summary.withoutDate?' · '+summary.withoutDate+' sin fecha límite registrada':'')+
  '. Consulta autorizada de solo lectura; abre PQRS para revisar los expedientes. No se cambiaron registros.';
}
