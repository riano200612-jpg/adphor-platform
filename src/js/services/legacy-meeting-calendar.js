// Read-only calendar projection from the original José meetings import contract.
// Caller must supply only rows already authorized by server-side RLS.
const validDay=x=>/^\d{4}-\d{2}-\d{2}$/.test(x);
const validTime=x=>/^([01]\d|2[0-3]):[0-5]\d$/.test(x);
export function legacyMeetingCalendar(meetings,{projectId,from,to}={}) {
 if(!projectId||!validDay(from)||!validDay(to)||from>to)throw Error('Alcance y fechas del calendario requeridos');
 return (meetings||[]).filter(m=>m.project_id===projectId &&
  m.read_only===true && m.source==='jose_reuniones_sheet' &&
  validDay(m.event_date) && validTime(m.start_local) &&
  m.event_date>=from && m.event_date<=to)
  .map(m=>({id:String(m.legacy_id),project_id:projectId,
    date:m.event_date,time:m.start_local,
    title:[m.type,m.specification].filter(Boolean).join(' · '),
    modality:m.modality,status:m.status,read_only:true}))
  .sort((a,b)=>(a.date+'T'+a.time).localeCompare(b.date+'T'+b.time));
}
