// Local QA calendar, isolated from Google Calendar and productive Supabase.
const KEY='adphor.qa.meetings.v1';
const getAll=()=>{try{const v=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(v)?v:[]}catch{return []}};
const save=rows=>localStorage.setItem(KEY,JSON.stringify(rows));
export function listDemoMeetings(projectId){return getAll().filter(r=>r.project_id===projectId).sort((a,b)=>a.start.localeCompare(b.start))}
export function scheduleDemoMeeting(projectId,fields,now=Date.now()){
 const start=new Date(fields.start),end=new Date(fields.end);
 if(!projectId||!fields.title?.trim()||!Number.isFinite(+start)||!Number.isFinite(+end)||+end<=+start)throw Error('Completa asunto, inicio y fin.');
 if(+start<=now)throw Error('Selecciona un horario futuro.');
 const rows=getAll(),active=rows.filter(x=>x.project_id===projectId&&x.status!=='cancelled'&&x.id!==fields.id);
 if(active.some(x=>+start<new Date(x.end).getTime()+1800000 && +end+1800000>new Date(x.start).getTime()))
   throw Error('Conflicto: existe otra reunión con margen de 30 minutos.');
 const late=+start-now<86400000;
 const priority=['alto','medio','bajo'].includes(fields.priority)?fields.priority:'medio';
 const management=Boolean(fields.management)||priority==='alto';
 const id=fields.id||crypto.randomUUID(),previous=rows.find(x=>x.id===id&&x.project_id===projectId);
 if(previous&&previous.status==='cancelled')throw Error('No se puede reprogramar una reunión cancelada.');
 const result={id,project_id:projectId,title:fields.title.trim(),start:start.toISOString(),end:end.toISOString(),
   priority,management,status:late?'pending_management':'scheduled',version:(previous?.version||0)+1,
   updated_at:new Date(now).toISOString()};
 save([result,...rows.filter(x=>x.id!==id)]);
 return result;
}
export function cancelDemoMeeting(projectId,id){
 const rows=getAll(),i=rows.findIndex(x=>x.project_id===projectId&&x.id===id);
 if(i<0)throw Error('Reunión no encontrada.');
 rows[i]={...rows[i],status:'cancelled',version:rows[i].version+1};save(rows);return rows[i];
}
