// Option A: prepares a human-initiated draft. No Google API calls or writes.
import {calendarInstant} from './calendar-availability.js';
const utc=value=>new Date(value).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
const instructions='Propuesta ADPHOR QA. No es una reserva ni una confirmación. El usuario autorizado debe revisar disponibilidad, seleccionar el calendario correcto y pulsar Guardar en Google Calendar.';
const validContext=(value,label)=>{
 if(typeof value!=='string'||value.length>160||/[\u0000-\u001f\u007f]/.test(value))
  throw Error('Contexto de '+label+' no válido.');
 return value.trim();
};
export function prepareManualGoogleDraft({title,start,end,property='',meetingType='',modality='',now=Date.now()}){
 if(typeof title!=='string'||title.trim().length<3||title.trim().length>200)
  throw Error('Escribe un asunto válido de 3 a 200 caracteres.');
 const a=calendarInstant(start),b=calendarInstant(end);
 if(!Number.isFinite(a)||!Number.isFinite(b)||b<=a||b-a<900000||b-a>43200000)
  throw Error('Indica inicio y fin válidos, entre 15 minutos y 12 horas.');
 if(!Number.isFinite(now)||a-now<86400000)
  throw Error('El inicio debe tener al menos 24 horas de anticipación.');
 const propertyName=validContext(property,'copropiedad');
 const meetingKind=validContext(meetingType,'reunión');
 const mode=validContext(modality,'modalidad');
 if(mode&&!['Presencial','Virtual','Mixta'].includes(mode))throw Error('Modalidad no válida.');
 const summary='[POR CONFIRMAR] '+title.trim();
 const guidance=[
  instructions,
  ...(propertyName?['Copropiedad: '+propertyName]:[]),
  ...(meetingKind?['Tipo de reunión: '+meetingKind]:[]),
  ...(mode?['Modalidad: '+mode]:[]),
  ...(mode==='Virtual'||mode==='Mixta'
    ?['Si corresponde, agrega Google Meet en el editor de Google Calendar antes de guardar.']
    :[]),
  'Selecciona el calendario corporativo Reuniones solo si tienes permiso de escritura.',
  'Para evitar duplicados, no importes el archivo ICS si ya guardaste el borrador en Google.'
 ].join('\n');
 const params=new URLSearchParams({action:'TEMPLATE',text:summary,dates:utc(a)+'/'+utc(b),
  ctz:'America/Bogota',stz:'America/Bogota',etz:'America/Bogota',details:guidance});
 return Object.freeze({url:'https://calendar.google.com/calendar/render?'+params,
  summary,start:utc(a),end:utc(b),guidance});
}
const escapeIcs=text=>String(text).replace(/\\/g,'\\\\').replace(/\r\n|\r|\n/g,'\\n')
 .replace(/;/g,'\\;').replace(/,/g,'\\,');
function foldIcs(line){
 let result='',bytes=0;const encoder=new TextEncoder();
 for(const char of line){
  const size=encoder.encode(char).length;
  if(bytes+size>75){result+='\r\n ';bytes=1;}
  result+=char;bytes+=size;
 }
 return result;
}
export function buildManualCalendarIcs({draft,uid,now=Date.now()}){
 if(!draft||typeof draft.summary!=='string'||!/^\d{8}T\d{6}Z$/.test(draft.start)||
    !/^\d{8}T\d{6}Z$/.test(draft.end))throw Error('Borrador de calendario no válido.');
 if(typeof uid!=='string'||!/^[a-zA-Z0-9-]{8,64}$/.test(uid)||!Number.isFinite(now))
  throw Error('Identificador del evento provisional no válido.');
 const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//ADPHOR//QA Manual Calendar//ES',
  'CALSCALE:GREGORIAN','METHOD:PUBLISH','BEGIN:VEVENT',
  'UID:'+uid+'@qa.adphor.invalid','DTSTAMP:'+utc(now),
  'DTSTART:'+draft.start,'DTEND:'+draft.end,
  'SUMMARY:'+escapeIcs(draft.summary),'DESCRIPTION:'+escapeIcs(draft.guidance||instructions),
  'STATUS:TENTATIVE','END:VEVENT','END:VCALENDAR'];
 return lines.map(foldIcs).join('\r\n')+'\r\n';
}
