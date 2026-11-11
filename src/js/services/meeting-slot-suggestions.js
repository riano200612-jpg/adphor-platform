import {calendarInstant,validateCalendarBusyIntervals} from './calendar-availability.js';
// Read-only calendar alternatives. No working-hours or companion policy is inferred.
const HALF_HOUR_MS=30*60*1000;
const HORIZON_MS=48*60*60*1000;
const instant=calendarInstant;
function validate(start,durationMinutes,limit=5){
 const initial=instant(start);
 if(!Number.isFinite(initial))throw Error('Inicio no válido para sugerencias.');
 if(!Number.isInteger(durationMinutes)||durationMinutes<15||durationMinutes>720)throw Error('Duración no válida para sugerencias.');
 if(!Number.isInteger(limit)||limit<1||limit>5)throw Error('Límite de sugerencias no válido.');
 return initial;
}
export function suggestMeetingSlots({busy,start,durationMinutes,limit=5,verifiedWindow}){
 const initial=validate(start,durationMinutes,limit);
 const lower=instant(verifiedWindow?.start),upper=instant(verifiedWindow?.end);
 if(!Number.isFinite(lower)||!Number.isFinite(upper)||upper<=lower)throw Error('Falta un intervalo de disponibilidad consultado válido.');
 const blocked=validateCalendarBusyIntervals(busy).map(slot=>[instant(slot.start),instant(slot.end)]);
 const duration=durationMinutes*60000,slots=[];
 for(let t=initial+HALF_HOUR_MS;t<=initial+HORIZON_MS&&slots.length<limit;t+=HALF_HOUR_MS){
  if(t-HALF_HOUR_MS<lower||t+duration+HALF_HOUR_MS>upper)continue;
  if(blocked.some(([a,b])=>a<t+duration+HALF_HOUR_MS&&b>t-HALF_HOUR_MS))continue;
  slots.push({start:new Date(t).toISOString(),end:new Date(t+duration).toISOString()});
 }
 return slots;
}
export async function loadMeetingSlotSuggestions({repo,projectId,start,durationMinutes,now=Date.now()}){
 const initial=validate(start,durationMinutes);
 if(!Number.isFinite(now)||initial-now<86400000)throw Error('El inicio debe tener al menos 24 horas de anticipación.');
 if(typeof projectId!=='string'||!projectId.trim()||typeof repo?.meetingAvailability!=='function')throw Error('La consulta de disponibilidad requiere una copropiedad y servicio autorizados.');
 const verifiedWindow={start:new Date(initial-HALF_HOUR_MS).toISOString(),end:new Date(initial+HORIZON_MS+durationMinutes*60000+HALF_HOUR_MS).toISOString()};
 // No fallback: a rejected or malformed service response must not become free time.
 const busy=await repo.meetingAvailability(projectId,verifiedWindow.start,verifiedWindow.end);
 return {slots:suggestMeetingSlots({busy,start,durationMinutes,verifiedWindow}),verifiedWindow};
}
