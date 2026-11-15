import {validateCalendarBusyIntervals} from './calendar-availability.js';

// A deliberate, read-only diagnostic for the existing QA Edge adapter.
// A successful provider response is not proof that bookings/Meet are connected.
const managed=new Set(['admin','coordinator']);
export function canProbeQaCorporateCalendar({repo,projectId,role}){
 return repo?.mode==='cloud'&&repo.qaCalendarEdgeEnabled===true&&
   repo.calendarAvailabilityConfigured===true&&
   typeof repo.meetingAvailability==='function'&&
   managed.has(role)&&typeof projectId==='string'&&
   /^[a-z0-9][a-z0-9-]{0,99}$/.test(projectId);
}
export async function probeQaCorporateCalendar({repo,projectId,role,now=Date.now()}){
 if(!canProbeQaCorporateCalendar({repo,projectId,role}))
  throw Error('QA_CALENDAR_PROBE_NOT_AUTHORIZED');
 if(!Number.isFinite(now)||now<0||now>Date.parse('2100-01-01T00:00:00Z'))
  throw Error('QA_CALENDAR_PROBE_BAD_TIME');
 // A short, future-only range. This does not reserve an event and does not
 // require a meeting subject, attendee, or a calendar ID in the browser.
 const start=new Date(now+24*3600000).toISOString();
 const end=new Date(now+25*3600000).toISOString();
 const busy=validateCalendarBusyIntervals(await repo.meetingAvailability(projectId,start,end));
 if(busy.length>1000)throw Error('QA_CALENDAR_PROBE_BAD_REPLY');
 return Object.freeze({
  source:'qa-calendar-availability',
  checkedAt:new Date(now).toISOString(),
  busyCount:busy.length,
  readonly:true,
 });
}
export function describeQaCorporateCalendarProbe(result){
 if(!result||result.source!=='qa-calendar-availability'||result.readonly!==true||
    !Number.isSafeInteger(result.busyCount)||result.busyCount<0||result.busyCount>1000||
    !Number.isFinite(Date.parse(result.checkedAt)))
  throw Error('QA_CALENDAR_PROBE_BAD_REPLY');
 return 'El servicio QA recibió una respuesta de Google Calendar freeBusy bajo esta sesión autorizada. '+
  'La ventana de prueba registró '+result.busyCount+' intervalo(s) ocupado(s). '+
  'No se consultaron asuntos ni invitados; no se creó ni cambió ningún evento. '+
  'Este resultado no certifica todavía la cuenta organizadora, Google Meet, invitaciones, reservas, cancelaciones ni permisos de acompañantes.';
}
export function qaCorporateCalendarProbeError(error){
 const message=typeof error?.message==='string'?error.message:'';
 if(message==='QA_CALENDAR_PROBE_NOT_AUTHORIZED')
  return 'La comprobación requiere un administrador o coordinador con sesión Cloud QA y el servicio Edge habilitado.';
 if(message==='El calendario corporativo aún no está configurado en QA.')
  return 'El servicio de Calendar respondió 503: faltan configuraciones o credenciales corporativas en Supabase QA. Ningún horario quedó certificado.';
 if(message==='La consulta requiere autorización y MFA AAL2.')
  return 'La consulta requiere sesión autorizada, membresía de esta copropiedad y MFA AAL2. Comprueba tu acceso antes de reintentar.';
 return 'No se pudo confirmar una respuesta real de Google Calendar en QA. Revisa la configuración y los registros del servicio con acceso administrativo; no se considera disponibilidad libre.';
}
