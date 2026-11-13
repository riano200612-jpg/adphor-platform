import {createMeetingRequestGate} from './services/meeting-request-gate.js';
import {calendarHasConflict} from './services/calendar-availability.js';
import {inspectQaRegisteredConflicts} from './services/qa-register-conflicts.js';
import {loadMeetingSlotSuggestions} from './services/meeting-slot-suggestions.js';
import { drawCompanionOptions } from './ui-companion-options.js';
import {enhanceMeetings,bogotaInput,bogotaInstant} from './ui-meeting-experience.js';
import {buildClientMeetingTitle,meetingDurationHours} from './services/client-meeting-mapping.js';
import {listDemoMeetings,scheduleDemoMeeting,cancelDemoMeeting,historyDemoMeeting,decideDemoMeeting,seedDemoMeetingScenarios} from './services/demo-calendar.js';

export function meetingGuidance({subject, start, accompaniment, availability, canCheck}) {
 if(subject.trim().length<3) return 'Paso 1 de 4. Escribe un asunto de al menos tres caracteres.';
 if(!start) return 'Paso 2 de 4. Indica la fecha y hora de inicio.';
 if(!accompaniment) return 'Paso 3 de 4. Selecciona un acompañante o «Sin acompañamiento requerido».';
 if(!canCheck) return 'Paso 4 de 4. Revisa los datos. La consulta de disponibilidad no está habilitada en esta vista.';
 switch(availability){
  case 'DISPONIBLE': return 'Paso 4 de 4. Puedes revisar la solicitud. La revisión no crea una reunión.';
  case 'OCUPADO': return 'Paso 4 de 4. Elige otro horario que respete el margen de 30 minutos.';
  case 'CONSULTA_FALLIDA': return 'Paso 4 de 4. No pudimos verificar el horario. Reintenta la consulta.';
  case 'consultando': return 'Paso 4 de 4. Espera el resultado de Google Calendar.';
  default: return 'Paso 4 de 4. Revisa la duración y verifica el horario en Google Calendar.';
 }
}

// This is an interactive local calendar in DEMO mode. Cloud mode remains assessment-only
// until authenticated transactional booking is verified on isolated QA PostgreSQL.
export function mountMeetingAssessment(root,{repo,projectId,projectName=projectId,role='viewer',members=[],sector='',isProjectCurrent=()=>true}) {
 const demo=repo.mode==='demo-calendar';
 root.innerHTML='<section class="panel"><h2>Reuniones y agenda gerencial</h2><p data-notice></p><form><label>Tipo de reunión<select name="meetingType"><option>Consejo</option><option>Asamblea</option><option>Comité</option><option>Gerencia</option><option>Otra</option></select></label><label>Subtipo<select name="subType"><option value="">Ninguno</option><option>Pre-Asamblea</option><option>Ordinaria</option><option>Extraordinaria</option></select></label><label>Modalidad<select name="modality"><option>Presencial</option><option>Virtual</option><option>Mixta</option></select></label><label>Especificación<input name="specification" maxlength="100"></label><label>Delegado asignado<input name="delegate" maxlength="120"></label><label>Asunto<input name="subject" required minlength="3" maxlength="200"></label><label>Notas<textarea name="notes" maxlength="5000"></textarea></label><label>Inicio<input name="start" type="datetime-local" required></label><label>Fin<input name="end" type="datetime-local"></label><label>Duración sugerida (horas)<input name="duration" type="number" min="0.25" max="12" step="0.25" placeholder="Automática según tipo"></label><label>Prioridad<select name="priority"><option value="bajo">Baja</option><option value="medio" selected>Media</option><option value="alto">Alta</option></select></label><label><input name="management" type="checkbox"> Solicitar asistencia de Gerencia</label><button>Evaluar y agendar</button><button type="button" data-clear>Nuevo horario</button></form><p role="status"></p><h3>Calendario de la copropiedad</h3><div data-list></div></section>';
 const escort=document.createElement('fieldset');escort.className='meeting-escorts';escort.innerHTML='<legend>Acompañamiento</legend><p>Selecciona a un responsable de tu copropiedad o indica que no se requiere acompañamiento.</p><div class="meeting-escort-carousel" role="radiogroup" aria-label="Responsable de acompañamiento"></div>';
 const escortChoices=escort.querySelector('.meeting-escort-carousel');
 const options=[{id:'',name:'Sin acompañamiento requerido',role:''},...members.filter(m=>m.project_id===projectId&&m.name&&['admin','coordinator','technician'].includes(m.role)).map(m=>({id:m.user_id,name:m.name,role:m.role}))];
 options.forEach((person,i)=>{const label=document.createElement('label');label.className='meeting-escort-card';const radio=document.createElement('input');radio.type='radio';radio.name='escort_id';radio.value=person.id;radio.checked=i===0;label.append(radio);const name=document.createElement('strong');name.textContent=person.name;label.append(name);if(person.role){const roleLabel=document.createElement('small');roleLabel.textContent=person.role;label.append(roleLabel);}escortChoices.append(label);});
 root.querySelector('form').append(escort);
 if(!demo&&repo.staffDirectoryEnabled){
  escortChoices.replaceChildren();
  repo.staffDirectory(projectId).then(people=>{
   if(!escortChoices.isConnected)return;
   const eligible=people.filter(p=>p.relationship==='coordinator'||['GG','GF','GT','CG','CO','A'].includes(p.role_code));
   drawCompanionOptions(escortChoices,eligible.map(p=>({id:p.id,nombre:p.name,leyendaRol:p.role_label,photoStoragePath:p.photo_path})),{photoUrl:id=>repo.staffPhotoUrl(projectId,id)});
  }).catch(()=>{if(escortChoices.isConnected){drawCompanionOptions(escortChoices,[]);const note=document.createElement('p');note.textContent='No se pudo consultar el equipo autorizado. Actualiza la vista.';escort.append(note);}});
 }else if(!demo&&repo.privateMediaEnabled){
  escortChoices.replaceChildren();
  repo.authorizedCompanions(projectId,sector).then(people=>{
    if(escortChoices.isConnected)drawCompanionOptions(escortChoices,people,{photoUrl:id=>repo.companionPhotoUrl(projectId,id)});
  }).catch(()=>{if(escortChoices.isConnected){drawCompanionOptions(escortChoices,[]);const note=document.createElement('p');note.textContent='No se pudo consultar el equipo autorizado. Actualiza la vista.';escort.append(note);}});
 }
 if(role==='admin' && !demo){
   const help=document.createElement('div');help.className='panel';
   const title=document.createElement('h3');title.textContent='Fotografías, dependencias y funciones del equipo';
   const note=document.createElement('p');note.textContent='El equipo y sus fotografías se consultan según los permisos de la copropiedad. Una imagen o asignación ausente no concede permisos adicionales.';
   const action=document.createElement('button');action.type='button';action.className='btn secondary';action.dataset.page='qa-source';action.textContent='Ver equipo y fotografías reales';
   help.append(title,note,action);escort.after(help);
 }
 const form=root.querySelector('form'),status=root.querySelector('[role=status]'),notice=root.querySelector('[data-notice]'),list=root.querySelector('[data-list]');
 const agendaGuide=document.createElement('details');
 agendaGuide.innerHTML='<summary>Miss ADPHOR · Consultar la agenda</summary>';
 const agendaHelp=document.createElement('p');
 agendaHelp.textContent=demo
  ? 'Consulta fechas y estados de las reuniones de esta copropiedad. Los cambios de horario y las cancelaciones solo afectan la simulación de este navegador.'
  : 'Consulta las reuniones verificadas de la copropiedad seleccionada y revisa su fecha, hora y estado. Esta vista de lectura no permite reprogramar ni cancelar eventos corporativos.';
 agendaGuide.append(agendaHelp);
 list.before(agendaGuide);
 notice.textContent=demo?'SIMULACIÓN LOCAL: citas en este navegador. No se enviarán invitaciones ni se modificará Google Calendar.':'VISTA DE REVISIÓN: consulta de reuniones verificadas según tu autorización y preparación de solicitudes. La creación de eventos y el envío de invitaciones requieren un backend transaccional autorizado.';
 if(!demo){const action=form.querySelector('button:not([type])');if(action){action.type='submit';action.disabled=true;action.textContent='Agendamiento real pendiente de backend QA';action.title='La creación de eventos requiere un servicio transaccional autorizado y certificado.';}}
 if(demo){const load=document.createElement('button');load.type='button';load.className='btn secondary';load.textContent='Cargar 3 reuniones de simulación';load.setAttribute('data-demo-scenarios','');notice.after(load);load.onclick=()=>{try{const n=seedDemoMeetingScenarios(projectId);status.textContent=n?n+' reuniones FICTICIAS añadidas únicamente a este navegador.':'Los escenarios de simulación ya estaban cargados.';render();}catch(error){status.textContent=error.message;}};}
 const canCheck=!demo && typeof repo.meetingAvailability === 'function' && ['admin','coordinator'].includes(role) && repo.calendarAvailabilityConfigured !== false;
 if(!demo && ['admin','coordinator'].includes(role) && repo.calendarAvailabilityConfigured === false){
  const readiness=document.createElement('p');
  readiness.className='notice';
  readiness.setAttribute('role','status');
  readiness.textContent='El calendario corporativo aún no está conectado en esta QA. No se pueden verificar horarios ni sugerir alternativas reales. Ninguna reunión se reserva desde este formulario.';
  form.append(readiness);
 }
 if(!demo && !canCheck && ['admin','coordinator'].includes(role) && typeof repo.listVerifiedQaMeetings==='function'){
  const qaButton=document.createElement('button');
  qaButton.type='button';
  qaButton.className='btn secondary';
  qaButton.textContent='Comprobar cruces en agenda ADPHOR QA';
  qaButton.setAttribute('data-qa-register-check','');
  const qaResult=document.createElement('p');
  qaResult.setAttribute('role','status');
  qaResult.setAttribute('data-qa-register-result','');
  form.append(qaButton,qaResult);
  let requestId=0;
  const snapshot=()=>JSON.stringify([...new FormData(form)]);
  const invalidate=()=>{requestId++;qaResult.textContent='';qaButton.disabled=false;};
  for(const eventName of ['input','change','reset'])form.addEventListener(eventName,invalidate);
  qaButton.onclick=async()=>{
   const request=++requestId,formSnapshot=snapshot();
   qaButton.disabled=true;
   qaResult.textContent='Revisando únicamente reuniones registradas en ADPHOR QA…';
   try{
    const start=bogotaInstant(form.elements.start.value);
    const hours=meetingDurationHours(form.elements.meetingType.value,form.elements.duration.value);
    const end=form.elements.end.value?bogotaInstant(form.elements.end.value):new Date(+start+hours*3600000);
    const minutes=(+end-+start)/60000;
    if(!Number.isInteger(minutes)||minutes<15||minutes>720)throw Error('Indica un horario válido de 15 minutos a 12 horas.');
    if(+start-Date.now()<86400000)throw Error('El inicio debe tener al menos 24 horas de anticipación.');
    const rows=await repo.listVerifiedQaMeetings(projectId);
    if(request!==requestId||!isProjectCurrent()||!qaButton.isConnected||snapshot()!==formSnapshot)return;
    const found=inspectQaRegisteredConflicts(rows,{projectId,start:start.toISOString(),end:end.toISOString()});
    qaResult.textContent=found.conflicts
     ?`${found.conflicts===1?'Se encontró 1 cruce':`Se encontraron ${found.conflicts} cruces`} con reuniones registradas en ADPHOR QA (margen de 30 minutos). No se consultó Google Calendar.`
     :`No se encontraron cruces en ${found.examined} reuniones registradas en ADPHOR QA. Esto NO confirma disponibilidad en Google Calendar ni reserva el horario.`;
   }catch(error){
    if(request===requestId&&isProjectCurrent()&&qaButton.isConnected){
     qaResult.textContent=error.message.startsWith('Indica un horario')||error.message.startsWith('El inicio debe')
      ?error.message:'No se pudo completar la revisión de agenda QA. No se confirmó disponibilidad.';
    }
   }finally{
    if(request===requestId&&isProjectCurrent()&&qaButton.isConnected)qaButton.disabled=false;
   }
  };
 }
 const guide=document.createElement('details');
 guide.innerHTML='<summary>Miss ADPHOR · Guía de la solicitud</summary><p aria-live="polite"></p>';
 form.before(guide);
 const guideMessage=guide.querySelector('p');
 const updateGuide=()=>{
  if(!guide.open)return;
  guideMessage.textContent=meetingGuidance({
   subject:form.elements.subject.value,
   start:form.elements.start.value,
   accompaniment:Boolean(form.querySelector('[name=escort_id]:checked')),
   availability:status.dataset.availability,
   canCheck
  });
 };
 const guideObserver=new MutationObserver(updateGuide);
 guide.addEventListener('toggle',()=>{
  if(guide.open){
   guideObserver.observe(status,{attributes:true,attributeFilter:['data-availability']});
   guideObserver.observe(escortChoices,{childList:true,subtree:true});
   updateGuide();
  }else guideObserver.disconnect();
 });
 form.addEventListener('input',()=>queueMicrotask(updateGuide));
 form.addEventListener('reset',()=>queueMicrotask(updateGuide));
 if (canCheck) {
  const availability=document.createElement('button');
  availability.type='button';
  availability.textContent='Verificar horario en Google Calendar';
  form.append(availability);
  const suggest=document.createElement('button');suggest.type='button';
  suggest.textContent='Sugerir otros horarios';form.append(suggest);
  const suggestions=document.createElement('section');
  suggestions.setAttribute('aria-label','Alternativas de horario');
  suggestions.setAttribute('aria-live','polite');form.append(suggestions);
  const snapshot=()=>JSON.stringify([...new FormData(form)]);
  const timeRange=()=>{
   const start=bogotaInstant(form.elements.start.value);
   const hours=meetingDurationHours(form.elements.meetingType.value,form.elements.duration.value);
   const end=form.elements.end.value?bogotaInstant(form.elements.end.value):new Date(+start+hours*3600000);
   const durationMinutes=(+end-+start)/60000;
   if(!Number.isInteger(durationMinutes)||durationMinutes<15||durationMinutes>720)throw Error('Indica un horario válido de 15 minutos a 12 horas.');
   return {start,end,durationMinutes};
  };
  const review=document.createElement('button');
  review.type='button';
  review.hidden=true;
  review.textContent='Revisar solicitud de reunión';
  form.append(review);
  const connected=()=>availability.isConnected&&suggest.isConnected&&isProjectCurrent();
  const requests=createMeetingRequestGate({snapshot,connected,onBusy:busy=>{
   availability.disabled=busy;suggest.disabled=busy;
  }});
  const clearAvailability=()=>{
   review.hidden=true;
   if (status.dataset.availability) status.textContent='';
   delete status.dataset.availability;
   suggestions.replaceChildren();
  };
  const invalidateAvailability=()=>{requests.invalidate();if(connected())clearAvailability();};
  form.addEventListener('input',invalidateAvailability);
  form.addEventListener('reset',invalidateAvailability);
  form.addEventListener('change',invalidateAvailability);
  suggest.onclick=async()=>{
   const request=requests.begin();if(!request)return;
   clearAvailability();const isCurrent=request.isCurrent;
   let range;
   try{range=timeRange();if(+range.start-Date.now()<86400000)throw Error('El inicio debe tener al menos 24 horas de anticipación.');}
   catch(error){if(isCurrent())suggestions.textContent=error.message;request.finish();return;}
   suggestions.textContent='Consultando alternativas en el calendario corporativo…';
   try{
    const {slots}=await loadMeetingSlotSuggestions({repo,projectId,start:range.start.toISOString(),durationMinutes:range.durationMinutes});
    if(!isCurrent())return;
    suggestions.replaceChildren();
    const note=document.createElement('p');
    note.textContent=slots.length
     ?'Alternativas sin conflictos reportados por el calendario, en hora Colombia. No verifican jornada laboral ni disponibilidad de acompañantes. No son reservas: selecciona una y vuelve a verificarla.'
     :'El calendario no devolvió alternativas sin conflictos en las próximas 48 horas consultadas.';
    suggestions.append(note);
    const fmt=new Intl.DateTimeFormat('es-CO',{timeZone:'America/Bogota',dateStyle:'medium',timeStyle:'short'});
    for(const slot of slots){
     const pick=document.createElement('button');pick.type='button';
     pick.textContent=fmt.formatRange(new Date(slot.start),new Date(slot.end));
     pick.onclick=()=>{
      if(!isCurrent())return;
      form.elements.start.value=bogotaInput(slot.start);form.elements.end.value=bogotaInput(slot.end);
      form.elements.start.dispatchEvent(new Event('input',{bubbles:true}));
      status.textContent='Horario propuesto seleccionado. Comprueba de nuevo su disponibilidad antes de revisar la solicitud. No se reservó ningún evento.';
     };suggestions.append(pick);
    }
   }catch{
    if(isCurrent()){suggestions.replaceChildren();suggestions.textContent='No se pudo comprobar la disponibilidad corporativa. No se generaron sugerencias.';}
   }finally{request.finish();}
  };
  availability.onclick=async()=>{
   const request=requests.begin();if(!request)return;
   clearAvailability();const isCurrent=request.isCurrent;
   let start, end;
   try {
    ({start,end}=timeRange());
   } catch (error) {
    if(isCurrent())status.textContent=error.message;
    request.finish();return;
   }
   if (!Number.isFinite(+start) || !Number.isFinite(+end) || +end<=+start || +end-+start>43200000) {
    if(isCurrent())status.textContent='Indica un horario válido de hasta 12 horas.';
    request.finish();return;
   }
   if (+start-Date.now()<86400000) {
    if(isCurrent())status.textContent='El horario requiere al menos 24 horas de anticipación para esta comprobación.';
    request.finish();return;
   }
   status.dataset.availability='consultando';
   status.textContent='Consultando el calendario corporativo…';
   try {
    const buffer=1800000;
    const busy=await repo.meetingAvailability(projectId,new Date(+start-buffer).toISOString(),new Date(+end+buffer).toISOString());
    if (!isCurrent()) return;
    const conflict=calendarHasConflict({busy,start:start.toISOString(),end:end.toISOString()});
    status.dataset.availability=conflict ? 'OCUPADO' : 'DISPONIBLE';
    status.textContent=conflict ? 'Horario ocupado o en conflicto con el margen de 30 minutos.'
     : 'Google Calendar no reporta conflictos para este horario. La comprobación es informativa y no reserva el evento.';
    if (!conflict) {
     review.hidden=false;
     review.onclick=()=>{
      if (!review.isConnected || !isCurrent() || !form.reportValidity()) return;
      const formatter=new Intl.DateTimeFormat('es-CO',{dateStyle:'medium',timeStyle:'short',timeZone:'America/Bogota'});
      const escort=form.querySelector('[name=escort_id]:checked');
      const summary=[
       projectName,form.elements.meetingType.value,form.elements.subject.value,
       formatter.formatRange(start,end),
       escort?.closest('label')?.textContent?.trim() || 'Acompañamiento pendiente de revisar',
       'La creación de eventos todavía no está habilitada en QA.'
      ].join('\n');
      if (!window.confirm(summary+'\n\n¿Confirmas que estos son los datos de la solicitud?')) return;
      status.textContent='Datos confirmados para revisión. No se creó un evento.';
      review.hidden=true;
     };
    }
   } catch {
    if (isCurrent()) {
     status.dataset.availability='CONSULTA_FALLIDA';
     status.textContent='No se pudo verificar el calendario corporativo. Vuelve a intentar la consulta.';
    }
   } finally {
    request.finish();
   }
  };
 }
 let editing=null, experience;
 let verifiedCloudRows=[];
 function render(){
  experience?.draw();
  list.replaceChildren();
  if(!demo){
    if(!verifiedCloudRows.length){list.textContent='No hay reuniones verificadas disponibles en la base QA para esta copropiedad. El Excel histórico no se considera una reserva activa.';return;}
    for(const m of verifiedCloudRows){
      const item=document.createElement('article');item.className='panel';
      const title=document.createElement('h4');title.textContent=m.title;
      const description=document.createElement('p');
      description.textContent=new Date(m.start).toLocaleString('es-CO',{timeZone:'America/Bogota'})+' → '+new Date(m.end).toLocaleString('es-CO',{timeZone:'America/Bogota'})+' · Confirmación verificada, lectura QA';
      item.append(title,description);list.append(item);
    }
    return;
  }
  const rows=listDemoMeetings(projectId);
  if(!rows.length){list.textContent='Todavía no hay reuniones registradas para esta copropiedad.';return;}
  for(const m of rows){
   const item=document.createElement('article');item.className='panel';
   const title=document.createElement('h4');title.textContent=m.title;
   const desc=document.createElement('p');
   desc.textContent=new Date(m.start).toLocaleString('es-CO',{timeZone:'America/Bogota'})+' → '+new Date(m.end).toLocaleString('es-CO',{timeZone:'America/Bogota'})+' · '+m.priority.toUpperCase()+' · '+(m.management?'Gerencia requerida':'Sin Gerencia')+' · '+(m.status==='pending_management'?'Pendiente de aprobación 24 h':m.status==='cancelled'?'Cancelada':'Agendada (demo)');
   item.append(title,desc);
   if(m.status!=='cancelled'){
    const edit=document.createElement('button');edit.textContent='Reprogramar';edit.type='button';edit.onclick=()=>{
      editing=m.id;experience.open();form.elements.subject.value=m.subject||m.title;for(const key of ['meetingType','subType','modality','specification','delegate','attendees','notes','duration']){if(m[key]!==undefined)form.elements[key].value=m[key];}form.elements.start.value=localInput(m.start);
      form.elements.end.value=localInput(m.end);form.elements.priority.value=m.priority;
      form.elements.management.checked=m.management;const escortRadio=[...form.querySelectorAll('[name=escort_id]')].find(r=>r.value===(m.escort_id||''));if(escortRadio)escortRadio.checked=true;status.textContent='Editando reunión '+m.title;form.scrollIntoView({block:'nearest'});
    };
    const cancel=document.createElement('button');cancel.textContent='Cancelar';cancel.type='button';cancel.onclick=()=>{
      if(!window.confirm('¿Cancelar esta reunión local? No se enviarán notificaciones.'))return;cancelDemoMeeting(projectId,m.id);if(editing===m.id)editing=null;status.textContent='Cancelación local registrada.';render();
    };
    const google=document.createElement('button');google.type='button';google.textContent='Preparar en Google Calendar';google.onclick=()=>{
      const compact=iso=>new Date(iso).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
      const params=new URLSearchParams({action:'TEMPLATE',text:m.title,
        dates:compact(m.start)+'/'+compact(m.end),
        details:'Propuesta ADPHOR QA. Confirmar manualmente en Google Calendar. Gerencia: '+(m.management?'requerida':'no requerida')});
      window.open('https://calendar.google.com/calendar/render?'+params.toString(),'_blank','noopener,noreferrer');
    };
    const history=document.createElement('button');history.type='button';history.textContent='Ver historial';history.onclick=()=>{const detail=document.createElement('pre');detail.textContent=historyDemoMeeting(projectId,m.id).map(h=>h.at+' · '+h.action+(h.reason?' · '+h.reason:'')).join('\n');item.append(detail);history.disabled=true;};
    item.append(edit,cancel,google,history);
   }
   if(m.status==='pending_management'&&['admin','management'].includes(role)){
    const help=document.createElement('p');help.textContent='La decisión requiere un administrador o Gerencia; en esta demo no se comprueban roles reales.';item.append(help);
    const reason=document.createElement('input');reason.setAttribute('aria-label','Motivo de la decisión');reason.placeholder='Motivo de la decisión';reason.maxLength=300;item.append(reason);
    for(const [action,label] of [['approve','Aprobar (demo)'],['reject','Rechazar (demo)']]){
      const button=document.createElement('button');button.type='button';button.textContent=label;
      button.onclick=()=>{try{decideDemoMeeting(projectId,m.id,{role,decision:action,reason:reason.value});status.textContent='Decisión registrada localmente, sin efectos externos.';render();}catch(e){status.textContent=e.message;}};
      item.append(button);
    }
   }
   list.append(item);
  }
 }
 function localInput(value){return bogotaInput(value);}
 form.querySelector('[data-clear]').onclick=()=>{editing=null;form.reset();status.textContent='Nuevo horario.';};
 form.onsubmit=async e=>{
  e.preventDefault();const button=form.querySelector('[type=submit]');button.disabled=true;status.textContent='Evaluando…';
  try{
   const data=new FormData(form);
   const assessment=await repo.assessMeeting(projectId,{subject:data.get('subject'),notes:data.get('notes'),management_requested:data.has('management')});
   if(!root.isConnected)return;
   if(!demo){status.textContent='Evaluación: '+assessment.priority_level+'. '+assessment.reason+'. No se agendó: backend pendiente.';return;}
   const clientTitle=buildClientMeetingTitle({type:data.get('meetingType'),subType:data.get('subType'),specification:data.get('specification'),property:projectName,modality:data.get('modality')});
   const startTime=bogotaInstant(data.get('start'));
   const duration=meetingDurationHours(data.get('meetingType'),data.get('duration'));
   const endTime=data.get('end')?bogotaInstant(data.get('end')):new Date(startTime.getTime()+duration*3600000);
   const result=scheduleDemoMeeting(projectId,{...Object.fromEntries(data),id:editing,title:clientTitle+' · '+data.get('subject'),start:startTime.toISOString(),end:endTime.toISOString(),priority:data.get('priority'),management:data.has('management')||assessment.requires_management});
   status.textContent=result.status==='pending_management'?'Solicitud registrada localmente, PENDIENTE DE APROBACIÓN GERENCIAL por ventana menor a 24 h. No constituye una reserva real.':'Reunión agendada en el calendario local de prueba. Sin invitaciones externas.';
   editing=null;form.reset();render();experience.reset();
  }catch(error){status.textContent=error.message;}finally{button.disabled=false;}
 };
 experience=enhanceMeetings(root,{form,list,projectName,demo,getRows:()=>demo?listDemoMeetings(projectId):verifiedCloudRows});
 render();
 if(!demo && typeof repo.listVerifiedQaMeetings==='function'){
   repo.listVerifiedQaMeetings(projectId).then(rows=>{
     if(!root.isConnected)return;
     verifiedCloudRows=(Array.isArray(rows)?rows:[]).map(r=>({
       id:r.id,title:r.title,start:r.start_at,end:r.end_at,status:'confirmed'
     }));
     render();
   }).catch(error=>{
     if(!root.isConnected)return;
     status.textContent='No se pudo consultar la agenda QA autorizada: '+error.message;
   });
 }
}
