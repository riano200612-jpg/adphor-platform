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
 if(typeof repo.checkCalendarOAuthDatabase==='function'){
  const databaseButton=document.createElement('button');
  const databaseStatus=document.createElement('p');
  databaseButton.type='button';
  databaseButton.className='btn secondary';
  databaseButton.textContent='Comprobar conexión privada de OAuth (QA)';
  databaseStatus.setAttribute('aria-live','polite');
  databaseButton.addEventListener('click',async()=>{
   if(databaseButton.disabled||!panel.isConnected||!isProjectCurrent())return;
   databaseButton.disabled=true;
   databaseStatus.textContent='Verificando el acceso a Supabase QA…';
   try{
    await repo.checkCalendarOAuthDatabase(projectId);
    if(panel.isConnected&&isProjectCurrent()) databaseStatus.textContent='Conexión privada y permisos verificados. Esta prueba no conecta Google Calendar.';
   }catch{
    if(panel.isConnected&&isProjectCurrent()) databaseStatus.textContent='No se pudo verificar la conexión privada con tu sesión.';
   }finally{
    if(panel.isConnected&&isProjectCurrent()) databaseButton.disabled=false;
   }
  });
  panel.append(databaseButton,databaseStatus);
 }
 if(typeof repo.startCalendarOAuthPilot==='function'&&typeof repo.finalizeCalendarOAuthPilot==='function'){
  const pilotStatus=document.createElement('p');
  pilotStatus.setAttribute('aria-live','polite');
  const controls=[
   ['Conectar Google Calendar (piloto)',async()=>{
    const destination=await repo.startCalendarOAuthPilot(projectId);
    if(panel.isConnected&&isProjectCurrent()) window.location.assign(destination);
   }],
   ['Finalizar conexión tras el consentimiento',async()=>{
    await repo.finalizeCalendarOAuthPilot(projectId);
    if(panel.isConnected&&isProjectCurrent()) pilotStatus.textContent='Autorización guardada. La lectura de eventos se verifica por separado.';
   }],
  ];
  for(const [label,action] of controls){
   const control=document.createElement('button');
   control.type='button';
   control.className='btn secondary';
   control.textContent=label;
   control.addEventListener('click',async()=>{
    if(control.disabled||!panel.isConnected||!isProjectCurrent())return;
    control.disabled=true;
    pilotStatus.textContent='Verificando la sesión y el acceso piloto…';
    try{await action();}
    catch{
     if(panel.isConnected&&isProjectCurrent()) pilotStatus.textContent='No se pudo completar el piloto. Comprueba que esté habilitado y que hayas vuelto a la misma copropiedad y sesión.';
    }finally{control.disabled=false;}
   });
   panel.append(control);
  }
  panel.append(pilotStatus);
 }
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
