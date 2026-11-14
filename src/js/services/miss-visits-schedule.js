import {calendarInstant} from './calendar-availability.js';
import {bogotaAgendaDate} from './verified-agenda.js';

// Safe, read-only view of the existing MFA AAL2-gated QA Visits repository.
// Times are displayed only after membership enforcement by the repository.
const allowed=new Set(['programada','en_ejecucion','completada','cancelada']);
const normalize=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const maxRows=5000;
const week=7*86400000;

export function missVisitsScheduleIntent(question){
 const q=normalize(question).replace(/[¿?]/g,'').replace(/\s+/g,' ').trim()
   .replace(/^miss adphor,? /,'');
 if(/^(?:visitas de hoy|visitas para hoy|que visitas hay hoy|que visitas tenemos hoy|cuales son las visitas de hoy)$/.test(q))return 'today';
 if(/^(?:proximas visitas|mis proximas visitas|cuales son las proximas visitas|cuales son las proximas visitas de esta copropiedad|que visitas hay programadas para los proximos siete dias|visitas de los proximos 7 dias)$/.test(q))return 'next';
 return null;
}

export function summarizeMissVisitsSchedule(rows,projectId,mode,now=Date.now()){
 if(!/^[a-z0-9][a-z0-9-]{0,99}$/.test(projectId)||!['today','next'].includes(mode)||
    !Number.isFinite(now)||!Array.isArray(rows)||rows.length>=maxRows)
  throw Error('Calendario de Visitas no verificable.');
 const seen=new Set();
 const matches=[];
 let running=0;
 const startDay=bogotaAgendaDate(now);
 if(!startDay)throw Error('Día de Colombia no verificable.');
 for(const visit of rows){
  if(!visit||visit.project_id!==projectId||!allowed.has(visit.status)||
     typeof visit.request_id!=='string'||!visit.request_id.trim()||
     seen.has(visit.request_id))throw Error('Registro de Visitas no verificable.');
  const instant=calendarInstant(visit.scheduled_at);
  if(!Number.isFinite(instant))throw Error('Fecha de Visitas no verificable.');
  seen.add(visit.request_id);
  if(visit.status==='en_ejecucion')running++;
  if(!['programada','en_ejecucion'].includes(visit.status))continue;
  if(mode==='today' ? bogotaAgendaDate(instant)!==startDay :
     !(instant>=now && instant<now+week))continue;
  matches.push({scheduledAt:visit.scheduled_at,status:visit.status});
 }
 matches.sort((a,b)=>calendarInstant(a.scheduledAt)-calendarInstant(b.scheduledAt));
 return Object.freeze({
  mode,projectId,count:matches.length,running,
  items:Object.freeze(matches.slice(0,5).map(item=>Object.freeze(item))),
  source:'supabase_qa_visits',readonly:true
 });
}

export function describeMissVisitsSchedule(summary){
 if(!summary||summary.source!=='supabase_qa_visits'||summary.readonly!==true||
    !['today','next'].includes(summary.mode)||!Number.isSafeInteger(summary.count)||
    !Number.isSafeInteger(summary.running)||summary.count<0||summary.running<0||
    !Array.isArray(summary.items)||summary.items.length>5||summary.items.length>summary.count||
    summary.items.some(item=>!allowed.has(item.status)||!Number.isFinite(calendarInstant(item.scheduledAt))))
  throw Error('Agenda de Visitas no verificable.');
 const label=summary.mode==='today'?'hoy (horario de Colombia)':'en los próximos 7 días';
 const date=new Intl.DateTimeFormat('es-CO',{dateStyle:'medium',timeStyle:'short',timeZone:'America/Bogota'});
 const times=summary.items.map(item=>date.format(new Date(item.scheduledAt))+
  (item.status==='en_ejecucion'?' · En ejecución':' · Programada')).join(' / ');
 return 'Visitas de esta copropiedad '+label+': '+summary.count+
  ' programadas o en ejecución en el período. Visitas actualmente en ejecución en el registro: '+
  summary.running+'.'+
  (times?' Horarios registrados: '+times+'.':' No hay visitas activas registradas para el período seleccionado.')+
  (summary.count>5?' Se muestran las primeras 5.':'')+
  ' Fuente: Supabase QA bajo tu sesión y MFA AAL2. Son visitas registradas, no reservas ni disponibilidad de Google Calendar; no se modificaron datos.';
}
