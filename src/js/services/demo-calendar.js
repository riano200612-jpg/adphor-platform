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
 const history=[...(previous?.history||[]),{action:previous?'rescheduled':'created',at:new Date(now).toISOString(),previous_start:previous?.start||null,previous_end:previous?.end||null}];
 const metadata=Object.fromEntries(['subject','meetingType','subType','modality','specification','delegate','attendees','notes','duration','escort_id'].map(k=>[k,String(fields[k]??previous?.[k]??'')]));
 const result={...metadata,id,history,project_id:projectId,title:fields.title.trim(),start:start.toISOString(),end:end.toISOString(),
   priority,management,status:late?'pending_management':'scheduled',version:(previous?.version||0)+1,
   updated_at:new Date(now).toISOString()};
 save([result,...rows.filter(x=>x.id!==id)]);
 return result;
}
export function cancelDemoMeeting(projectId,id){
 const rows=getAll(),i=rows.findIndex(x=>x.project_id===projectId&&x.id===id);
 if(i<0)throw Error('Reunión no encontrada.');
 rows[i]={...rows[i],status:'cancelled',version:rows[i].version+1,history:[...(rows[i].history||[]),{action:'cancelled',at:new Date().toISOString()}]};save(rows);return rows[i];
}

// Manager review is a demo-only approval; it cannot authorize Google Calendar or SQL writes.
export function decideDemoMeeting(projectId,id,{role,decision,reason=''}){
 if(role!=='admin'&&role!=='management')throw Error('Aprobación reservada para administración o Gerencia.');
 if(!['approve','reject'].includes(decision)||!String(reason).trim())throw Error('Indica decisión y motivo.');
 const rows=getAll(),i=rows.findIndex(x=>x.project_id===projectId&&x.id===id);
 if(i<0)throw Error('Reunión no encontrada.');
 if(rows[i].status!=='pending_management')throw Error('No existe una solicitud pendiente de Gerencia.');
 const now=new Date().toISOString();
 rows[i]={...rows[i],status:decision==='approve'?'scheduled':'rejected',version:rows[i].version+1,
 history:[...(rows[i].history||[]),{action:decision==='approve'?'approved':'rejected',reason:String(reason).trim(),at:now,actor_role:role}]};
 save(rows);return rows[i];
}
export function historyDemoMeeting(projectId,id){
 const row=getAll().find(x=>x.id===id&&x.project_id===projectId);
 if(!row)throw Error('Reunión no encontrada.');
 return [...(row.history||[])];
}

// Explicit synthetic demonstration fixtures, isolated by project and opt-in.
export function seedDemoMeetingScenarios(projectId, now=new Date()) {
 if(!projectId || typeof projectId!=='string')throw Error('Selecciona una copropiedad.');
 const existing=listDemoMeetings(projectId);
 const cases=[
  {tag:'qa-adphor-consejo',subject:'Revisión del plan de mantenimiento (SIMULACIÓN)',meetingType:'Consejo',priority:'medio',management:false,days:3,hour:9,duration:2},
  {tag:'qa-adphor-comite',subject:'Comité de seguimiento PQRS (SIMULACIÓN)',meetingType:'Comité',priority:'alto',management:true,days:5,hour:14,duration:1},
  {tag:'qa-adphor-gerencia',subject:'Seguimiento de recorridos (SIMULACIÓN)',meetingType:'Gerencia',priority:'medio',management:true,days:7,hour:10,duration:1}
 ];
 let created=0;
 for(const row of cases){
  if(existing.some(m=>m.notes?.includes(row.tag)))continue;
  const start=new Date(now);start.setDate(start.getDate()+row.days);start.setHours(row.hour,0,0,0);
  // Date objects preserve the runtime local date, while storing UTC instants consistently.
  const end=new Date(start.getTime()+row.duration*3600000);
  scheduleDemoMeeting(projectId,{title:row.subject,subject:row.subject,meetingType:row.meetingType,
   start:start.toISOString(),end:end.toISOString(),priority:row.priority,management:row.management,
   modality:'Mixta',notes:row.tag+' · DATOS FICTICIOS',escort_id:''},now.getTime());
  created++;
 }
 return created;
}
