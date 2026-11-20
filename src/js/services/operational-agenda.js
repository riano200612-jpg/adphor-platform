import {today,STATES,isManager} from '../core/workflow.js';

// Read-only projection over the existing persisted maintenance bitacora.
// No new source, synthetic recurrent task or Google Calendar write is created.
const DATE=/^\d{4}-\d{2}-\d{2}$/;
export function validOperationalDate(value){
 if(typeof value!=='string'||!DATE.test(value))return false;
 const parsed=new Date(value+'T00:00:00.000Z');
 return Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===value;
}
export function addOperationalDays(value,days){
 if(!validOperationalDate(value)||!Number.isInteger(days))throw Error('Fecha de agenda inválida.');
 const date=new Date(value+'T00:00:00.000Z');
 date.setUTCDate(date.getUTCDate()+days);
 return date.toISOString().slice(0,10);
}

export function buildOperationalAgenda(tickets,{projectId,userId,role='viewer',scope='mine',asOf=today()}={}){
 if(!Array.isArray(tickets)||typeof projectId!=='string'||!projectId.trim()||
   typeof userId!=='string'||!userId.trim()||!validOperationalDate(asOf))
  throw Error('No se puede consultar la agenda sin un usuario y copropiedad autorizados.');
 if(!['mine','team'].includes(scope)||(scope==='team'&&!isManager(role)))
  throw Error('La supervisión del equipo requiere un rol autorizado.');
 const d7=addOperationalDays(asOf,7),d15=addOperationalDays(asOf,15);
 const definitions=[
  ['overdue','Vencidos'],['today','Hoy'],['week','Próximos 7 días'],
  ['fortnight','Días 8 a 15'],['later','Posteriores a 15 días']
 ];
 const groups=definitions.map(([key,label])=>({key,label,items:[]}));
 const byKey=Object.fromEntries(groups.map(g=>[g.key,g]));
 let unclassified=0;
 for(const row of tickets){
  // Personal mode only sees the authenticated actor; manager team mode sees
  // assigned and unassigned rows for this property only. Server RLS still owns
  // the authorization boundary; this projection cannot confer SQL privileges.
  if(row?.project_id!==projectId||(scope==='mine'&&row.assignee!==userId)||row.status==='Cerrada')continue;
  if(typeof row.id!=='string'||!row.id.trim()||typeof row.title!=='string'||
     !row.title.trim()||!STATES.includes(row.status)||!validOperationalDate(row.due_date)){
   unclassified++;continue;
  }
  const key=row.due_date<asOf?'overdue':row.due_date===asOf?'today':
    row.due_date<=d7?'week':row.due_date<=d15?'fortnight':'later';
  byKey[key].items.push({
   id:row.id,title:row.title,due_date:row.due_date,status:row.status,
   priority:typeof row.priority==='string'?row.priority:'',
   area:typeof row.area==='string'?row.area:'',
   assignee:typeof row.assignee==='string'?row.assignee:''
  });
 }
 for(const group of groups)group.items.sort((a,b)=>
  a.due_date.localeCompare(b.due_date)||a.title.localeCompare(b.title,'es'));
 const total=groups.reduce((sum,group)=>sum+group.items.length,0);
 return {asOf,groups,total,unclassified,source:'persisted-tickets',scope};
}
