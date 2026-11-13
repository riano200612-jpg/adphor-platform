// Pure, portable contract for the read-only ADPHOR QA Google Calendar adapter.
export const QA_PROJECT_URL = 'https://qfctnnnnltghepwujpdm.supabase.co';
export const QA_FRONTEND = 'https://qa-integral-claude-reviewed.adphor-platform.pages.dev';
export const QA_SOURCE = 'google_freebusy';

export function calendarInstant(value) {
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

export function validateAvailabilityBody(input) {
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).sort().join(',')!=='end,project_id,start')throw Error('Solicitud inválida.');
  const {project_id,start,end}=input;
  if(typeof project_id!=='string'||!/^[a-z0-9][a-z0-9-]{0,99}$/.test(project_id))throw Error('Copropiedad inválida.');
  const a=calendarInstant(start),b=calendarInstant(end);
  if(!Number.isFinite(a)||!Number.isFinite(b)||b<=a||b-a>7*24*3600000)throw Error('Intervalo de consulta inválido.');
  return {project_id,start,end};
}

export function parseValidatedAal2(jwt,userId) {
  if(typeof jwt!=='string'||jwt.length>8192||jwt.split('.').length!==3)return false;
  try{
    const payload=jwt.split('.')[1];
    if(!/^[A-Za-z0-9_-]+$/.test(payload))return false;
    const decoded=JSON.parse(atob(payload.replace(/-/g,'+').replace(/_/g,'/')));
    // Only call AFTER Supabase Auth verifies the same JWT by /auth/v1/user.
    return decoded?.sub===userId && decoded?.aal==='aal2' && decoded?.role==='authenticated';
  }catch{return false;}
}

export function normalizeBusy(result,calendarId) {
  const bucket=result?.calendars?.[calendarId];
  if(!bucket||bucket.errors?.length||!Array.isArray(bucket.busy))throw Error('Respuesta de calendario inválida.');
  if(bucket.busy.length>1000)throw Error('Demasiados intervalos para este piloto.');
  return bucket.busy.map(slot=>{
    const a=calendarInstant(slot?.start),b=calendarInstant(slot?.end);
    if(!Number.isFinite(a)||!Number.isFinite(b)||b<=a)throw Error('Intervalo de origen inválido.');
    return {start:slot.start,end:slot.end};
  });
}
