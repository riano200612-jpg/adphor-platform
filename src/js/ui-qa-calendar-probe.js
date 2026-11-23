import {
 canProbeQaCorporateCalendar,probeQaCorporateCalendar,
 describeQaCorporateCalendarProbe,qaCorporateCalendarProbeError
} from './services/qa-calendar-probe.js';

const safeDatabaseTransportCodes = new Set(['CONNECT_TIMEOUT', 'CONNECTION_CLOSED', 'CONNECTION_ENDED', 'CONNECTION_DESTROYED', 'ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'EHOSTUNREACH', 'ENETUNREACH', 'EAI_AGAIN', 'ENOTFOUND', 'ERR_TLS_HANDSHAKE_TIMEOUT', 'ERR_TLS_CERT_ALTNAME_INVALID', 'ERR_TLS_UNSUPPORTED_PROTOCOL', 'ERR_TLS_INVALID_PROTOCOL_VERSION', 'ERR_STREAM_PREMATURE_CLOSE', 'ERR_WORKER_UNSUPPORTED_OPERATION', 'ERR_INVALID_ARG_TYPE', 'ERR_MODULE_NOT_FOUND', 'ERR_SSL_WRONG_VERSION_NUMBER', 'ERR_SSL_BAD_RECORD_MAC', 'TYPEERROR', 'RANGEERROR', 'OTHER']);

const privateDiagnosticMessages=new Map([
 ['CAL_ACCESS','Cloudflare Access no verificó la solicitud.'],
 ['CAL_ACCESS_UNAVAILABLE','No se pudo consultar la validación de Cloudflare Access.'],
 ['CAL_ORIGIN','El origen de la solicitud no coincide con QA Integral.'],
 ['CAL_REQUEST','La solicitud del diagnóstico no es válida.'],
 ['CAL_SESSION','La sesión de Supabase falta o ya no es válida.'],
 ['CAL_AAL2','La sesión todavía no tiene MFA AAL2.'],
 ['CAL_AUTH_UNAVAILABLE','No se pudo consultar la validación de la sesión en Supabase.'],
 ['CAL_MEMBERSHIP','La sesión no tiene un rol administrativo vigente en la copropiedad seleccionada.'],
 ['CAL_MEMBERSHIP_UNAVAILABLE','No se pudo consultar la membresía en Supabase.'],
 ['CAL_DB_CONFIG','El runtime rechazó la configuración de conexión al pooler QA.'],
 ['CAL_DB_LOGIN','PostgreSQL rechazó el login dedicado.'],
 ['CAL_DB_TLS','No se pudo validar TLS con el pooler.'],
 ['CAL_DB_TRANSPORT','Falló la conexión al pooler antes de obtener un código SQL verificable.'],
 ['CAL_DB_SQL','PostgreSQL rechazó la consulta de diagnóstico.'],
 ['CAL_DB_PERMISSIONS','El login, los permisos o RLS no coinciden con el perfil esperado.'],
 ['CAL_RUNTIME_CONFIG','El runtime de QA no pudo preparar los controles del diagnóstico.'],
]);

export function privateCalendarDiagnosticMessage(error) {
 const message=typeof error?.message==='string'?error.message:'';
 const transport=/^CAL_DB_TRANSPORT(?::([^:]{1,128}))?$/.exec(message);
 const reason=transport&&safeDatabaseTransportCodes.has(transport[1])?transport[1]:'';
 const code=transport?'CAL_DB_TRANSPORT':privateDiagnosticMessages.has(message)?message:'CAL_NO_DIAGNOSTIC';
 const detail=reason?' Código técnico del runtime: '+reason+'.':'';
 return '['+code+'] '+(privateDiagnosticMessages.get(code)??'La respuesta no incluyó un diagnóstico del backend de QA.')+detail;
}

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
 if(repo.privateCalendarOnly===true){
  title.textContent='Google Calendar privado (QA)';
  panel.setAttribute('aria-label','Google Calendar privado (QA)');
  help.textContent='La comprobación usa la conexión privada de QA. La disponibilidad requiere completar la autorización de Google.';
  panel.append(title,help);
 }else{
  panel.append(title,help,button,status);
 }
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
   }catch(error){
    if(panel.isConnected&&isProjectCurrent()) databaseStatus.textContent=privateCalendarDiagnosticMessage(error);
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
