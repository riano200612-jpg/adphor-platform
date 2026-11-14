import {calendarInstant} from './calendar-availability.js';

export const AGENDA_SOURCE_UNAVAILABLE = 'La fuente de reuniones verificadas todavía no está habilitada en QA.';
export const AGENDA_GENERIC_LOAD_ERROR = 'No se pudo consultar la agenda. Verifica tu sesión y la habilitación del calendario; puedes volver a intentarlo.';
// PGRST205 means PostgREST cannot find the verified meeting source in its schema cache.
// Never turn a missing source into an empty calendar or expose raw backend errors in the UI.
export function readVerifiedAgendaQuery(result) {
 if(result?.error?.code==='PGRST205')throw Error(AGENDA_SOURCE_UNAVAILABLE);
 if(result?.error)throw Error(result.error.message||'No se pudo consultar la agenda.');
 return result?.data;
}
export function verifiedAgendaUiError(error) {
 return error?.message===AGENDA_SOURCE_UNAVAILABLE?AGENDA_SOURCE_UNAVAILABLE:AGENDA_GENERIC_LOAD_ERROR;
}
const normalize=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export function bogotaAgendaDate(value){
 const date=new Date(value);
 if(!Number.isFinite(date.getTime()))return '';
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Bogota',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
 const part=name=>parts.find(item=>item.type===name)?.value;
 return `${part('year')}-${part('month')}-${part('day')}`;
}
export async function loadVerifiedAgenda(repo,projectId){
 if(!projectId)throw Error('Selecciona una copropiedad autorizada.');
 if(repo?.verifiedCalendarEnabled===false)throw Error('El calendario verificado no está habilitado en este entorno.');
 if(typeof repo?.listVerifiedQaMeetings!=='function')throw Error('La consulta de reuniones verificadas no está disponible.');
 const rows=await repo.listVerifiedQaMeetings(projectId);
 return validateVerifiedQaMeetingRows(rows,projectId);
}
// A single, fail-closed contract for both Home/Reuniones and Agenda.
// The server must enforce membership/RLS; this extra check rejects unexpected
// tenant data, invalid sources, duplicate identifiers and truncated responses.
export function validateVerifiedQaMeetingRows(rows,projectId){
 if(typeof projectId!=='string'||!projectId.trim()||!Array.isArray(rows))
  throw Error('Respuesta de agenda no válida.');
 // Backend queries up to 501; reaching 500 means completeness is unknown.
 if(rows.length>=500)throw Error('La agenda QA está incompleta. No se puede certificar la consulta.');
 const seen=new Set();
 for(const row of rows){
  const start=calendarInstant(row?.start_at),end=calendarInstant(row?.end_at);
  if(!row||row.project_id!==projectId||row.is_calendar_verified!==true||
     row.source_status!=='Confirmada'||typeof row.id!=='string'||!row.id.trim()||
     seen.has(row.id))
   throw Error('La respuesta de agenda contiene registros no verificables.');
  if(typeof row.title!=='string'||!row.title.trim()||
     !Number.isFinite(start)||!Number.isFinite(end)||end<=start)
   throw Error('Hay reuniones con datos de horario incompletos.');
  seen.add(row.id);
 }
 return [...rows].map(row=>({...row}))
   .sort((a,b)=>calendarInstant(a.start_at)-calendarInstant(b.start_at));
}
export function filterVerifiedAgenda(rows,{search='',date='',status=''}={}){
 const needle=normalize(search).trim();
 return rows.filter(row=>(!needle||normalize([row.title,row.kind,row.source_status].join(' ')).includes(needle))&&
  (!date||bogotaAgendaDate(row.start_at)===date)&&(!status||row.source_status===status));
}
