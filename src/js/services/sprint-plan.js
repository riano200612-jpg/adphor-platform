import {today,STATES} from '../core/workflow.js';
import {addOperationalDays,validOperationalDate} from './operational-agenda.js';

// QA provisional cadence: reference 2026-12-01, pending client approval.
// Read-only projection. No invented recurrences or writes.
export const SPRINT_REFERENCE_START='2026-12-01';
const DAY=86400000;
const utc=value=>Date.parse(value+'T00:00:00.000Z');
export const canSeeTeamSprint=role=>role==='admin'||role==='coordinator';

export function sprintWindow({asOf=today(),offset=0}={}){
 if(!validOperationalDate(asOf)||!Number.isSafeInteger(offset)||Math.abs(offset)>26)
  throw Error('Período quincenal no válido.');
 const cycle=Math.floor((utc(asOf)-utc(SPRINT_REFERENCE_START))/(14*DAY))+offset;
 const start=addOperationalDays(SPRINT_REFERENCE_START,cycle*14);
 return {start,end:addOperationalDays(start,13),cycle,days:14};
}

export function buildSprintPlan(tickets,{projectId,userId,role,scope='mine',asOf=today(),offset=0}={}){
 if(!Array.isArray(tickets)||typeof projectId!=='string'||!projectId.trim()||
   typeof userId!=='string'||!userId.trim()||!['mine','team'].includes(scope)||
   !['admin','coordinator','technician','viewer'].includes(role))
  throw Error('Contexto de planificación no verificable.');
 if(scope==='team'&&!canSeeTeamSprint(role))throw Error('El plan del equipo requiere un coordinador autorizado.');
 const window=sprintWindow({asOf,offset});
 const summary={pending:0,inProgress:0,toVerify:0,closed:0};
 const inside=[],carryover=[],later=[];
 let invalid=0;const ids=new Set();
 for(const row of tickets){
  if(row?.project_id!==projectId||(scope==='mine'&&row.assignee!==userId))continue;
  if(typeof row.id!=='string'||!row.id.trim()||ids.has(row.id)||
    typeof row.title!=='string'||!row.title.trim()||
    typeof row.assignee!=='string'||!row.assignee.trim()||
    !STATES.includes(row.status)||!validOperationalDate(row.due_date)){
   invalid++;continue;
  }
  ids.add(row.id);
  const item={id:row.id,title:row.title,due_date:row.due_date,status:row.status,
    priority:typeof row.priority==='string'?row.priority:'',
    area:typeof row.area==='string'?row.area:'',assignee:row.assignee};
  if(row.due_date<window.start){
   if(row.status!=='Cerrada')carryover.push(item);
  }else if(row.due_date<=window.end){
   inside.push(item);
   if(row.status==='Pendiente')summary.pending++;
   if(row.status==='En proceso')summary.inProgress++;
   if(row.status==='Por verificar')summary.toVerify++;
   if(row.status==='Cerrada')summary.closed++;
  }else if(row.status!=='Cerrada')later.push(item);
 }
 const sort=(a,b)=>a.due_date.localeCompare(b.due_date)||a.title.localeCompare(b.title,'es');
 for(const group of [inside,carryover,later])group.sort(sort);
 return {window,scope,projectId,userId,summary,inside,carryover,later,invalid,
   source:'persisted-tickets',cadence:'provisional',readonly:true};
}
