import {validateCalendarAvailabilityResponse} from './calendar-availability.js';

// No private credential enters the browser: Supabase forwards the end-user JWT.
export async function invokeQaCalendarAvailability(functions,projectId,start,end){
 if(!functions||typeof functions.invoke!=='function')throw Error('Servicio de calendario QA no disponible.');
 const {data,error}=await functions.invoke('qa-calendar-availability',{
  body:{project_id:projectId,start,end},
 });
 if(error){
  const status=error.context?.status;
  if(status===401||status===403)throw Error('La consulta requiere autorización y MFA AAL2.');
  if(status===503)throw Error('El calendario corporativo aún no está configurado en QA.');
  throw Error('No se pudo comprobar el calendario corporativo. No se generaron horarios disponibles.');
 }
 if(data?.source!=='google_freebusy')throw Error('La respuesta no acredita consulta corporativa.');
 return validateCalendarAvailabilityResponse(data,projectId);
}
