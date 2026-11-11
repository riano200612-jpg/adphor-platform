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
 if(!Array.isArray(rows))throw Error('Respuesta de agenda no válida.');
 const scoped=rows.filter(row=>row.project_id===projectId&&row.is_calendar_verified===true);
 if(scoped.some(row=>!row.id||!Number.isFinite(Date.parse(row.start_at))||!Number.isFinite(Date.parse(row.end_at))||Date.parse(row.end_at)<=Date.parse(row.start_at)))throw Error('Hay reuniones con datos de horario incompletos.');
 return scoped.map(row=>({...row})).sort((a,b)=>Date.parse(a.start_at)-Date.parse(b.start_at));
}
export function filterVerifiedAgenda(rows,{search='',date='',status=''}={}){
 const needle=normalize(search).trim();
 return rows.filter(row=>(!needle||normalize([row.title,row.kind,row.source_status].join(' ')).includes(needle))&&
  (!date||bogotaAgendaDate(row.start_at)===date)&&(!status||row.source_status===status));
}
