import {buildMissWeeklyManagementPreview} from './miss-weekly-management.js';
import {QA_URL} from './qa-auth-policy.js';
const HOST='qa-integral-claude-reviewed.adphor-platform.pages.dev';
const DAY=86400000;
const SCOPED={tasks:['tickets','project_id,created_at,due_date,status'],visits:['qa_visits','project_id,created_at,finished_at,status'],pqrs:['pilot_pqrs','project_id,created_at,closed_at'],meetings:['qa_meeting_events','project_id,start_at,is_calendar_verified']};
const keys=['tasksCreated','tasksOverdueAtCutoff','visitsRegistered','visitsFinished','pqrsNew','pqrsClosed','meetingsImported'];
const inWeek=(value,a,b)=>typeof value==='string'&&Number.isFinite(Date.parse(value))&&Date.parse(value)>=a&&Date.parse(value)<b;
const strip=x=>String(x??'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
const isClosed=x=>['cerrada','cerrado','closed','finalizado','finalizada'].includes(strip(x));
function dateBogota(now){const p=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Bogota',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(now));const d=Object.fromEntries(p.map(x=>[x.type,x.value]));return [d.year,d.month,d.day].join('-');}
export function missQaCurrentWeek(now=Date.now()){
 if(!Number.isFinite(now))throw Error('Fecha inválida.');
 const today=dateBogota(now);const base=Date.parse(today+'T00:00:00Z');
 return new Date(base-((new Date(base).getUTCDay()+6)%7)*DAY).toISOString().slice(0,10);
}
function span(weekStart,now){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(weekStart||''))throw Error('Fecha del lunes inválida.');
 const d=Date.parse(weekStart+'T00:00:00Z');
 if(!Number.isFinite(d)||new Date(d).toISOString().slice(0,10)!==weekStart||new Date(d).getUTCDay()!==1)throw Error('Fecha del lunes inválida.');
 const a=d+5*60*60000,b=a+7*DAY;
 if(now<a||now>b)throw Error('Solo se permite la semana QA en curso.');
 return {a,b,cutoff:new Date(now).toISOString(),date:dateBogota(now)};
}
export function summarizeMissQaWeek({weekStart,now,projectIds,sources}){
 const w=span(weekStart,now);
 if(!Array.isArray(projectIds)||!projectIds.length||projectIds.length>43||
  projectIds.some(x=>typeof x!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(x))||
  new Set(projectIds).size!==projectIds.length)throw Error('Ámbito inválido.');
 const allow=new Set(projectIds),data={};
 for(const k of Object.keys(SCOPED)){
  const rows=sources?.[k]??null;
  if(rows!==null&&(!Array.isArray(rows)||rows.length>5000||rows.some(x=>!x||!allow.has(x.project_id))))throw Error('Datos ajenos o inválidos.');
  data[k]=rows;
 }
 const out=projectIds.map(projectId=>{
  const rows=k=>data[k]?.filter(x=>x.project_id===projectId)??null;
  const tasks=rows('tasks'),visits=rows('visits'),pqrs=rows('pqrs'),meetings=rows('meetings');
  return {projectId,
   tasksCreated:tasks===null?null:tasks.filter(x=>inWeek(x.created_at,w.a,w.b)).length,
   tasksOverdueAtCutoff:tasks===null?null:tasks.filter(x=>!isClosed(x.status)&&typeof x.due_date==='string'&&x.due_date<w.date).length,
   visitsRegistered:visits===null?null:visits.filter(x=>inWeek(x.created_at,w.a,w.b)).length,
   visitsFinished:visits===null?null:visits.filter(x=>strip(x.status)==='completada'&&inWeek(x.finished_at,w.a,w.b)).length,
   pqrsNew:pqrs===null?null:pqrs.filter(x=>inWeek(x.created_at,w.a,w.b)).length,
   pqrsClosed:pqrs===null?null:pqrs.filter(x=>inWeek(x.closed_at,w.a,w.b)).length,
   meetingsImported:meetings===null?null:meetings.filter(x=>x.is_calendar_verified===true&&inWeek(x.start_at,w.a,w.b)).length
  };
 });
 const previewRows=out.map(x=>({
  project_id:x.projectId,tasks:null,
  visits:data.visits===null?null:{source:'public.qa_visits',created:x.visitsRegistered,completed:x.visitsFinished},
  pqrs:data.pqrs===null?null:{source:'public.pilot_pqrs',created:x.pqrsNew,resolved:x.pqrsClosed},
  meetings:data.meetings===null?null:{source:'public.qa_meeting_events',registered:x.meetingsImported}
 }));
 const gate=buildMissWeeklyManagementPreview({weekStart,cutoff:w.cutoff,authorizedPropertyIds:projectIds,rows:previewRows});
 const totals=Object.fromEntries(keys.map(k=>[k,out.some(x=>x[k]===null)?null:out.reduce((n,x)=>n+x[k],0)]));
 return Object.freeze({weekStart,cutoff:w.cutoff,status:gate.status,propertyCount:projectIds.length,
   totals,properties:out,coverage:gate.coverage,
   sourceStatus:Object.fromEntries(Object.keys(SCOPED).map(k=>[k,data[k]===null?'NO DISPONIBLE':'QA CONSULTADA'])),
   approved:false,exportCertified:false,automated:false,readonly:true,modelsReady:false,
   note:'BORRADOR QA. Tareas terminadas y cumplimiento: NO DISPONIBLE. Reuniones: importación, no Calendar en vivo.'});
}
async function readBounded(client,table,columns,ids){
 const rows=[];
 for(let offset=0;offset<=5000;offset+=500){
  const response=await client.from(table).select(columns).in('project_id',ids).range(offset,offset+499);
  if(response.error||!Array.isArray(response.data))return null;
  rows.push(...response.data);
  if(rows.length>5000)return null;
  if(response.data.length<500)return rows;
 }
 return null;
}
export function qaMissWeeklyReader(client,{url,hostname,getActor,now=()=>Date.now()}={}){
 return async ({weekStart,projectIds})=>{
  if(url!==QA_URL||hostname!==HOST)throw Error('Solo QA Integral.');
  if(!Array.isArray(projectIds)||!projectIds.length||projectIds.length>43||projectIds.some(x=>typeof x!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(x))||new Set(projectIds).size!==projectIds.length)throw Error('Ámbito inválido.');
  const identity=await client.auth.getUser(),actor=getActor?.();
  if(identity.error||!identity.data?.user?.id||actor?.id!==identity.data.user.id)throw Error('Sesión personal requerida.');
  const assurance=await client.auth.mfa.getAuthenticatorAssuranceLevel();
  if(assurance.error||assurance.data?.currentLevel!=='aal2')throw Error('Completa MFA AAL2.');
  const membership=await client.from('memberships').select('project_id,role').eq('user_id',actor.id);
  if(membership.error||!Array.isArray(membership.data))throw Error('Permisos no verificables.');
  const allowed=new Set(membership.data.filter(x=>['admin','coordinator'].includes(x.role)).map(x=>x.project_id));
  if(projectIds.some(id=>!allowed.has(id)))throw Error('Una copropiedad no está autorizada.');
  const stamp=now();span(weekStart,stamp);
  const sources=Object.fromEntries(await Promise.all(Object.entries(SCOPED).map(async([key,[table,cols]])=>{
   try{return [key,await readBounded(client,table,cols,projectIds)];}catch{return [key,null];}
  })));
  return summarizeMissQaWeek({weekStart,now:stamp,projectIds,sources});
 };
}
