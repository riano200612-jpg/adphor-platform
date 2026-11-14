import {calendarInstant} from './calendar-availability.js';
import {bogotaAgendaDate} from './verified-agenda.js';

// One QA tenant, three independent authorized sources, and no external effects.
// These rules are not trained agents and are not a live Google Calendar feed.
const normalize=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const pqrsStatuses=new Set(['open','assigned','in_progress']);
const visitStatuses=new Set(['programada','en_ejecucion','completada','cancelada']);
const validProject=value=>typeof value==='string'&&/^[a-z0-9][a-z0-9-]{0,99}$/.test(value);

export function isMissOperationalDayQuestion(question){
 const q=normalize(question).replace(/[¿?]/g,'').replace(/\s+/g,' ').trim().replace(/^miss adphor,? /,'');
 return /^(?:agenda operativa de hoy|agenda operativa hoy|resumen de actividades de hoy|actividades de hoy en esta copropiedad|que tengo hoy en adphor|como va el dia operativo)$/.test(q);
}

function checkedRows(rows,projectId,limit,idField){
 if(!Array.isArray(rows)||rows.length>=limit)throw Error('Lectura incompleta.');
 const seen=new Set();
 for(const row of rows){
  const id=row?.[idField];
  if(!row||row.project_id!==projectId||typeof id!=='string'||!id.trim()||seen.has(id))
   throw Error('Registro fuera del alcance o duplicado.');
  seen.add(id);
 }
 return rows;
}

export function summarizeMissOperationalDay({projectId,pqrs,visits,meetings,now=Date.now()}){
 if(!validProject(projectId)||!Number.isFinite(now))throw Error('Contexto no verificable.');
 const day=bogotaAgendaDate(now);
 if(!day)throw Error('Fecha no verificable.');
 checkedRows(pqrs,projectId,5000,'id');
 checkedRows(visits,projectId,5000,'request_id');
 checkedRows(meetings,projectId,500,'id');
 let pqrsOpen=0,pqrsOverdue=0,pqrsDueToday=0,visitsToday=0,visitsRunning=0,meetingsToday=0;
 for(const row of pqrs){
  if(!pqrsStatuses.has(row.status))throw Error('Estado PQRS no verificable.');
  pqrsOpen++;
  if(row.due_at==null||row.due_at==='')continue;
  const timestamp=calendarInstant(row.due_at);
  if(!Number.isFinite(timestamp))throw Error('Fecha PQRS no verificable.');
  if(timestamp<now)pqrsOverdue++;
  if(bogotaAgendaDate(timestamp)===day)pqrsDueToday++;
 }
 for(const row of visits){
  if(!visitStatuses.has(row.status))throw Error('Estado de Visitas no verificable.');
  const timestamp=calendarInstant(row.scheduled_at);
  if(!Number.isFinite(timestamp))throw Error('Fecha de Visitas no verificable.');
  if(row.status==='en_ejecucion')visitsRunning++;
  if(['programada','en_ejecucion'].includes(row.status)&&bogotaAgendaDate(timestamp)===day)visitsToday++;
 }
 for(const row of meetings){
  if(row.is_calendar_verified!==true||row.source_status!=='Confirmada')
   throw Error('Fuente de reuniones no verificable.');
  const timestamp=calendarInstant(row.start_at);
  if(!Number.isFinite(timestamp))throw Error('Fecha de reunión no verificable.');
  if(bogotaAgendaDate(timestamp)===day)meetingsToday++;
 }
 return Object.freeze({projectId,day,pqrsOpen,pqrsOverdue,pqrsDueToday,
  visitsToday,visitsRunning,meetingsToday,source:'supabase_qa_scoped',engine:'rules',readonly:true});
}

export function describeMissOperationalDay(summary){
 if(!summary||summary.source!=='supabase_qa_scoped'||summary.engine!=='rules'||summary.readonly!==true||
  !/^\d{4}-\d{2}-\d{2}$/.test(summary.day)||!validProject(summary.projectId)||
  ['pqrsOpen','pqrsOverdue','pqrsDueToday','visitsToday','visitsRunning','meetingsToday']
   .some(key=>!Number.isSafeInteger(summary[key])||summary[key]<0))
  throw Error('Resumen no verificable.');
 const tasks=[];
 if(summary.pqrsOverdue)tasks.push('revisar PQRS vencidas');
 if(summary.pqrsDueToday)tasks.push('revisar vencimientos de PQRS de hoy');
 if(summary.visitsRunning)tasks.push('consultar Visitas en ejecución');
 if(summary.visitsToday)tasks.push('consultar Visitas registradas para hoy');
 if(summary.meetingsToday)tasks.push('revisar Agenda importada');
 if(!tasks.length)tasks.push('verificar el Centro integrado antes de tomar decisiones');
 return 'Agenda operativa de '+summary.day+' (Colombia), solo para esta copropiedad: '+
  'PQRS '+summary.pqrsOpen+' en gestión, '+summary.pqrsOverdue+' vencidas y '+
  summary.pqrsDueToday+' con vencimiento hoy. '+
  'Visitas '+summary.visitsToday+' registradas hoy, '+summary.visitsRunning+' en ejecución en el sistema. '+
  'Reuniones '+summary.meetingsToday+' confirmadas en la importación QA para hoy. '+
  'Recomendación de Operaciones → Análisis → Informes por reglas: '+tasks.join('; ')+'. '+
  'Fuentes: Supabase QA y permisos de tu sesión. La Agenda es una importación puntual, no confirma eventos actuales de Google Calendar ni disponibilidad libre. '+
  'Miss ADPHOR no ejecutó cambios, reservas, decisiones ni notificaciones.';
}
