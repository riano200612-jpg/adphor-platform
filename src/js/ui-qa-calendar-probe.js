import {
 canProbeQaCorporateCalendar,probeQaCorporateCalendar,
 describeQaCorporateCalendarProbe,qaCorporateCalendarProbeError
} from './services/qa-calendar-probe.js';

// Place the diagnostic outside the booking wizard: it never submits a form.
export function mountQaCalendarProbe(host,{repo,projectId,role,isProjectCurrent=()=>true}){
 host.replaceChildren();
 if(repo?.mode!=='cloud'||!['admin','coordinator'].includes(role))return;
 const panel=document.createElement('section');
 panel.className='panel qa-calendar-diagnostic';
 panel.setAttribute('aria-label','Diagnóstico del calendario corporativo QA');
 const title=document.createElement('h3');
 title.textContent='Comprobar conexión corporativa (QA)';
 const help=document.createElement('p');
 help.className='muted';
 help.textContent='Prueba de lectura de Google Calendar para esta copropiedad, con tu sesión y MFA AAL2. No crea eventos, no lee asuntos ni sustituye la certificación de agendamiento.';
 const button=document.createElement('button');
 button.type='button';
 button.className='btn secondary';
 button.dataset.qaCalendarProbe='';
 button.textContent='Comprobar conexión Google Calendar';
 const status=document.createElement('p');
 // Keep an independent live region without creating a second role=status in Reuniones.
 status.setAttribute('aria-live','polite');
 status.dataset.qaCalendarProbeResult='';
 const enabled=canProbeQaCorporateCalendar({repo,projectId,role});
 button.disabled=!enabled;
 status.textContent=enabled
  ?'No se ha ejecutado una comprobación de conexión en esta sesión.'
  :'El conector de Google Calendar QA no está habilitado. No se pueden certificar horarios.';
 panel.append(title,help,button,status);
 host.append(panel);
 let serial=0;
 button.addEventListener('click',async()=>{
  if(button.disabled||!panel.isConnected||!isProjectCurrent())return;
  const request=++serial;
  button.disabled=true;
  status.textContent='Verificando el servicio corporativo bajo tu sesión…';
  try{
   const outcome=await probeQaCorporateCalendar({repo,projectId,role});
   if(request!==serial||!panel.isConnected||!isProjectCurrent())return;
   status.textContent=describeQaCorporateCalendarProbe(outcome);
  }catch(error){
   if(request!==serial||!panel.isConnected||!isProjectCurrent())return;
   status.textContent=qaCorporateCalendarProbeError(error);
  }finally{
   if(request===serial&&panel.isConnected&&isProjectCurrent())button.disabled=!enabled;
  }
 });
}
