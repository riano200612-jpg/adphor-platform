import {calendarInstant} from './calendar-availability.js';
export const visitStates=Object.freeze({programada:'Programada',en_ejecucion:'En ejecución',completada:'Completada',cancelada:'Cancelada'});
export function visitActions(status){
 return status==='programada'?['edit','start','cancel']:status==='en_ejecucion'?['progress','finish','cancel']:[];
}
export function visitLocalDate(value){
 const instant=calendarInstant(value);
 return Number.isFinite(instant)?new Date(instant-5*3600000).toISOString().slice(0,16):'';
}
export function visitSchedule(start){
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(start??'')||!Number.isFinite(calendarInstant(start+':00-05:00')))throw Error('Fecha de visita no válida.');
 return start+':00-05:00';
}
export function visitTransitionPayload(action,values={}){
 const text=(key,max,required=false)=>{
  if(typeof values[key]!=='string'||values[key].trim().length>max||(required&&!values[key].trim()))throw Error('Completa los datos requeridos de la visita.');
  return values[key].trim();
 };
 if(action==='start')return {};
 if(action==='edit')return {responsible_id:text('responsibleId',36,true),motive:text('kind',200,true),scheduled_at:visitSchedule(values.start)};
 if(action==='cancel')return {reason:text('reason',1000,true)};
 if(['progress','finish'].includes(action))return {observations:text('observations',4000),activities:text('activities',4000),conclusions:text('conclusions',4000,action==='finish'),commitments:text('commitments',4000)};
 throw Error('Operación de visita no válida.');
}
