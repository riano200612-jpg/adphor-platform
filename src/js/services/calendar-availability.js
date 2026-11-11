// Require complete timestamps with a known timezone. Date.parse alone accepts
// rollover dates and timezone-free values that must not imply available time.
export function calendarInstant(value){
 if(typeof value!=='string')return NaN;
 const m=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d{1,3})?(Z|([+-])(\d{2}):(\d{2}))$/.exec(value);
 if(!m||m[8]==='-00:00')return NaN;
 const [year,month,day,hour,minute,second]=m.slice(1,7).map(Number);
 const leap=year%4===0&&(year%100!==0||year%400===0);
 const days=[31,leap?29:28,31,30,31,30,31,31,30,31,30,31];
 if(month<1||month>12||day<1||day>days[month-1]||hour>23||minute>59||second>59)return NaN;
 if(m[8]!=='Z'&&(Number(m[10])>23||Number(m[11])>59))return NaN;
 const time=Date.parse(value);
 return Number.isFinite(time)?time:NaN;
}
export function validateCalendarBusyIntervals(busy){
 if(!Array.isArray(busy))throw Error('La disponibilidad corporativa no es válida.');
 const result=[];
 for(const slot of busy){
  const a=calendarInstant(slot?.start),b=calendarInstant(slot?.end);
  if(!Number.isFinite(a)||!Number.isFinite(b)||b<=a)throw Error('Google Calendar devolvió un intervalo ocupado no válido.');
  result.push({start:slot.start,end:slot.end});
 }
 return result;
}
export function calendarHasConflict({busy,start,end}){
 const a=calendarInstant(start),b=calendarInstant(end),buffer=1800000;
 if(!Number.isFinite(a)||!Number.isFinite(b)||b<=a)throw Error('Intervalo de consulta no válido.');
 const slots=validateCalendarBusyIntervals(busy);
 return slots.some(slot=>calendarInstant(slot.start)<b+buffer&&calendarInstant(slot.end)>a-buffer);
}
export function validateCalendarAvailabilityResponse(data,projectId){
 if(typeof projectId!=='string'||!projectId.trim()||!data||data.project_id!==projectId||data.timezone!=='America/Bogota')throw Error('Respuesta de disponibilidad inválida.');
 return validateCalendarBusyIntervals(data.busy);
}
