import {calendarInstant} from './calendar-availability.js';

// Advisory checks against already registered, scoped QA meeting records ONLY.
// Never infer live Google Calendar availability from an empty QA register.
export function inspectQaRegisteredConflicts(rows,{projectId,start,end}){
 const from=calendarInstant(start),to=calendarInstant(end);
 if(typeof projectId!=='string'||!projectId.trim()||!Number.isFinite(from)||!Number.isFinite(to)||to<=from||to-from>12*3600000){
  throw Error('Intervalo o copropiedad no válido.');
 }
 if(!Array.isArray(rows)||rows.length>=500)throw Error('La consulta de reuniones QA no está completa.');
 let conflicts=0;
 for(const row of rows){
  // Data must already be server-filtered by RLS + the selected property.
  if(!row||row.project_id!==projectId||row.is_calendar_verified!==true||row.source_status!=='Confirmada')
   throw Error('La fuente de reuniones registradas devolvió datos no autorizados.');
  const a=calendarInstant(row.start_at),b=calendarInstant(row.end_at);
  if(!Number.isFinite(a)||!Number.isFinite(b)||b<=a)
   throw Error('El registro de reuniones contiene horarios no válidos.');
  if(a<to+1800000 && b>from-1800000)conflicts++;
 }
 return {conflicts,examined:rows.length,source:'registered_qa_only'};
}
