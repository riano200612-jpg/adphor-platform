import { drawCompanionOptions } from './ui-companion-options.js';
import {enhanceMeetings,bogotaInput,bogotaInstant} from './ui-meeting-experience.js';
import {buildClientMeetingTitle,meetingDurationHours} from './services/client-meeting-mapping.js';
import {listDemoMeetings,scheduleDemoMeeting,cancelDemoMeeting,historyDemoMeeting,decideDemoMeeting,seedDemoMeetingScenarios} from './services/demo-calendar.js';

// This is an interactive local calendar in DEMO mode. Cloud mode remains assessment-only
// until authenticated transactional booking is verified on isolated QA PostgreSQL.
export function mountMeetingAssessment(root,{repo,projectId,projectName=projectId,role='viewer',members=[],sector=''}) {
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
   const note=document.createElement('p');note.textContent='El carrusel de fotos reales del sábado está en el visor privado del cliente. Carga una vez el ZIP de datos y el multimedia para relacionar copropiedad, responsable, cargo, sector y foto. No se han publicado fotos ni creado asignaciones automáticas.';
   const action=document.createElement('button');action.type='button';action.className='btn secondary';action.dataset.page='qa-source';action.textContent='Ver equipo y fotografías reales';
   help.append(title,note,action);escort.after(help);
 }
 const form=root.querySelector('form'),status=root.querySelector('[role=status]'),notice=root.querySelector('[data-notice]'),list=root.querySelector('[data-list]');
 notice.textContent=demo?'SIMULACIÓN LOCAL: citas en este navegador. No se enviarán invitaciones ni se modificará Google Calendar.':'VISTA DE REVISIÓN: formulario, calendario y carrusel habilitados visualmente; todavía NO hay reuniones reales importadas ni backend transaccional autorizado. No se enviarán invitaciones.';
 if(!demo){const action=form.querySelector('button:not([type])');if(action){action.type='submit';action.disabled=true;action.textContent='Agendamiento real pendiente de backend QA';action.title='La tabla operativa de reuniones aún no existe en esta base de datos.';}}
 if(demo){const load=document.createElement('button');load.type='button';load.className='btn secondary';load.textContent='Cargar 3 reuniones de simulación';load.setAttribute('data-demo-scenarios','');notice.after(load);load.onclick=()=>{try{const n=seedDemoMeetingScenarios(projectId);status.textContent=n?n+' reuniones FICTICIAS añadidas únicamente a este navegador.':'Los escenarios de simulación ya estaban cargados.';render();}catch(error){status.textContent=error.message;}};}
 if (!demo && typeof repo.meetingAvailability === 'function' && ['admin','coordinator'].includes(role)) {
  const availability=document.createElement('button');
  availability.type='button';
  availability.textContent='Verificar horario en Google Calendar';
  form.append(availability);
  const snapshot=()=>JSON.stringify([...new FormData(form)]);
  const review=document.createElement('button');
  review.type='button';
  review.hidden=true;
  review.textContent='Revisar solicitud de reunión';
  form.append(review);
  form.addEventListener('input',()=>{review.hidden=true;});
  form.addEventListener('reset',()=>{review.hidden=true;});
  availability.onclick=async()=>{
   review.hidden=true;
   const selection=snapshot();
   let start, end;
   try {
    start=bogotaInstant(form.elements.start.value);
    const duration=meetingDurationHours(form.elements.meetingType.value,form.elements.duration.value);
    end=form.elements.end.value ? bogotaInstant(form.elements.end.value) : new Date(+start+duration*3600000);
   } catch (error) {
    status.textContent=error.message;
    return;
   }
   if (!Number.isFinite(+start) || !Number.isFinite(+end) || +end<=+start || +end-+start>43200000) {
    status.textContent='Indica un horario válido de hasta 12 horas.';
    return;
   }
   if (+start-Date.now()<86400000) {
    status.textContent='El horario requiere al menos 24 horas de anticipación para esta comprobación.';
    return;
   }
   availability.disabled=true;
   status.textContent='Consultando el calendario corporativo…';
   try {
    const buffer=1800000;
    const busy=await repo.meetingAvailability(projectId,new Date(+start-buffer).toISOString(),new Date(+end+buffer).toISOString());
    if (!availability.isConnected || selection!==snapshot()) return;
    const conflict=busy.some(slot=>Date.parse(slot.start)<+end+buffer && Date.parse(slot.end)>+start-buffer);
    status.textContent=conflict ? 'Horario ocupado o en conflicto con el margen de 30 minutos.'
     : 'Google Calendar no reporta conflictos para este horario. La comprobación es informativa y no reserva el evento.';
    if (!conflict) {
     review.hidden=false;
     review.onclick=()=>{
      if (!review.isConnected || selection!==snapshot() || !form.reportValidity()) return;
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
   } catch (error) {
    if (availability.isConnected && selection===snapshot()) status.textContent=error.message;
   } finally {
    availability.disabled=false;
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
