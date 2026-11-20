// Google Calendar -> ADPHOR QA source mirror (pure read + diff).
// This module never calls Google write APIs, changes a source event, or touches SQL.
// Call it server-side only after a separate corporate OAuth read authorization.
const GOOGLE_EVENTS='https://www.googleapis.com/calendar/v3/calendars/';
const OFFSET=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;
const DATE=/^\d{4}-\d{2}-\d{2}$/;
const instant=(value)=>{
 if(typeof value!=='string'||!OFFSET.test(value))throw Error('Timestamp con zona requerido.');
 const ms=Date.parse(value);
 if(!Number.isFinite(ms))throw Error('Timestamp inválido.');
 return ms;
};
const safeId=(v,max=512)=>{
 if(typeof v!=='string'||v.length<1||v.length>max||/[\u0000-\u001f\u007f]/.test(v))
  throw Error('Identificador Google inválido.');
 return v;
};
const googleTime=(time)=>{
 if(time&&typeof time.dateTime==='string')return new Date(instant(time.dateTime)).toISOString();
 // QA uses Colombia. All-day Google end.date is exclusive, which is preserved.
 if(time&&typeof time.date==='string'&&DATE.test(time.date)){
  const iso=time.date+'T00:00:00-05:00';
  if(new Date(iso).toISOString().slice(0,10)!==time.date)throw Error('Fecha completa inválida.');
  return new Date(iso).toISOString();
 }
 throw Error('Hora de reunión no verificable.');
};
export function normalizeGoogleSourceEvent(event){
 if(!event||typeof event!=='object')throw Error('Evento Google inválido.');
 const id=safeId(event.id);
 const status=event.status||'confirmed';
 if(!['confirmed','tentative','cancelled'].includes(status))throw Error('Estado Google inválido.');
 // Cancelled recurring exceptions can carry ONLY an ID. Hold for review; never delete.
 if(status==='cancelled')return Object.freeze({id,status,needsReview:true});
 const start=googleTime(event.start),end=googleTime(event.end);
 if(Date.parse(end)<=Date.parse(start))throw Error('Intervalo Google inválido.');
 const summary=typeof event.summary==='string'&&event.summary.trim()?event.summary.trim():'(Sin asunto)';
 if(summary.length>500||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(summary))
  throw Error('Asunto Google fuera de límites.');
 return Object.freeze({id,status,summary,start,end});
}
function checkedWindow(timeMin,timeMax){
 const start=instant(timeMin),end=instant(timeMax);
 if(start>=end||end-start>93*86400000)throw Error('Ventana de Google Calendar no permitida.');
 return {start,end};
}
export async function readGoogleSourceWindow({
 calendarId,accessToken,timeMin,timeMax,request=fetch,maxPages=40
}){
 safeId(calendarId,255);
 if(typeof accessToken!=='string'||!accessToken||/[\s\r\n]/.test(accessToken))
  throw Error('Autorización corporativa de lectura ausente.');
 checkedWindow(timeMin,timeMax);
 if(!Number.isInteger(maxPages)||maxPages<1||maxPages>40)throw Error('Límite de páginas no válido.');
 let pageToken='',pages=0;
 const seenTokens=new Set(),seenIds=new Set(),events=[];
 do{
  if(++pages>maxPages)throw Error('Listado Google incompleto; no sincronizar.');
  const url=new URL(GOOGLE_EVENTS+encodeURIComponent(calendarId)+'/events');
  url.searchParams.set('timeMin',timeMin);
  url.searchParams.set('timeMax',timeMax);
  url.searchParams.set('timeZone','America/Bogota');
  url.searchParams.set('singleEvents','true');
  url.searchParams.set('showDeleted','true');
  url.searchParams.set('maxResults','250');
  url.searchParams.set('fields','nextPageToken,items(id,summary,status,start(date,dateTime),end(date,dateTime))');
  if(pageToken)url.searchParams.set('pageToken',pageToken);
  const response=await request(url.toString(),{
   method:'GET',redirect:'error',cache:'no-store',
   headers:{Authorization:'Bearer '+accessToken,Accept:'application/json'}
  });
  if(!response?.ok)throw Error('Google Calendar no disponible. Ningún cambio aplicado.');
  const json=await response.json();
  if(!json||!Array.isArray(json.items))throw Error('Respuesta Google incompleta.');
  for(const item of json.items){
   const normalized=normalizeGoogleSourceEvent(item);
   if(seenIds.has(normalized.id))throw Error('Evento Google duplicado entre páginas.');
   seenIds.add(normalized.id);
   events.push(normalized);
   if(events.length>10000)throw Error('Demasiados eventos para esta ventana.');
  }
  pageToken=json.nextPageToken||'';
  if(pageToken){
   if(typeof pageToken!=='string'||pageToken.length>2048||seenTokens.has(pageToken))
    throw Error('Paginación Google no verificable.');
   seenTokens.add(pageToken);
  }
 }while(pageToken);
 return Object.freeze({calendarId,timeMin,timeMax,pages,events});
}
export function planSourceMirrorDelta(snapshot,mirrorRows){
 if(!snapshot||!Array.isArray(snapshot.events)||!Array.isArray(mirrorRows))
  throw Error('Copia o lectura Google inválida.');
 const calendarId=safeId(snapshot.calendarId,255);
 const {start:min,end:max}=checkedWindow(snapshot.timeMin,snapshot.timeMax);
 const stored=new Map();
 for(const row of mirrorRows){
  if(!row||row.calendar_id!==calendarId)throw Error('Copropiedad u origen ajeno a la copia.');
  const id=safeId(row.google_event_id);
  if(stored.has(id))throw Error('Duplicados en el espejo de QA.');
  stored.set(id,row);
 }
 const toInsert=[],toUpdate=[],cancelledForReview=[],unchanged=[],seen=new Set();
 for(const event of snapshot.events){
  const id=safeId(event.id);
  if(seen.has(id))throw Error('Duplicados Google no verificables.');
  seen.add(id);
  if(event.status==='cancelled'){
   cancelledForReview.push(id);
   continue; // Google may omit dates for cancelled recurring instances. Never delete.
  }
  if(typeof event.summary!=='string'||!['confirmed','tentative'].includes(event.status))
   throw Error('Evento Google incompleto.');
  const a=instant(event.start),b=instant(event.end);
  if(a>=max||b<=min||b<=a)throw Error('Evento fuera de la ventana verificada.');
  const old=stored.get(id);
  if(!old){toInsert.push(event);continue;}
  if(old.summary!==event.summary || Date.parse(old.start_at)!==a ||
    Date.parse(old.end_at)!==b || old.source_status!==event.status)toUpdate.push(event);
  else unchanged.push(id);
 }
 // Absence in a bounded Google response is not a deletion and cannot revoke a meeting.
 const notReturnedForReview=[...stored.keys()].filter(id=>!seen.has(id));
 return Object.freeze({
  calendarId,complete:true,toInsert,toUpdate,unchangedCount:unchanged.length,
  cancelledForReview,notReturnedForReview,googleCount:snapshot.events.length
 });
}
