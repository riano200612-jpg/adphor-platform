import {buildClientMeetingTitle,meetingDurationHours} from './services/client-meeting-mapping.js';
import {listDemoMeetings,scheduleDemoMeeting,cancelDemoMeeting} from './services/demo-calendar.js';

// This is an interactive local calendar in DEMO mode. Cloud mode remains assessment-only
// until authenticated transactional booking is verified on isolated QA PostgreSQL.
export function mountMeetingAssessment(root,{repo,projectId}) {
 const demo=repo.mode==='demo-calendar';
 root.innerHTML='<section class="panel"><h2>Reuniones y agenda gerencial</h2><p data-notice></p><form><label>Tipo de reunión<select name="meetingType"><option>Consejo</option><option>Asamblea</option><option>Comité</option><option>Gerencia</option><option>Otra</option></select></label><label>Subtipo<select name="subType"><option value="">Ninguno</option><option>Pre-Asamblea</option><option>Ordinaria</option><option>Extraordinaria</option></select></label><label>Modalidad<select name="modality"><option>Presencial</option><option>Virtual</option><option>Mixta</option></select></label><label>Especificación<input name="specification" maxlength="100"></label><label>Delegado asignado<input name="delegate" maxlength="120"></label><label>Asunto<input name="subject" required minlength="3" maxlength="200"></label><label>Notas<textarea name="notes" maxlength="5000"></textarea></label><label>Inicio<input name="start" type="datetime-local" required></label><label>Fin<input name="end" type="datetime-local"></label><label>Duración sugerida (horas)<input name="duration" type="number" min="0.25" max="12" step="0.25" placeholder="Automática según tipo"></label><label>Prioridad<select name="priority"><option value="bajo">Baja</option><option value="medio" selected>Media</option><option value="alto">Alta</option></select></label><label><input name="management" type="checkbox"> Solicitar asistencia de Gerencia</label><button>Evaluar y agendar</button><button type="button" data-clear>Nuevo horario</button></form><p role="status"></p><h3>Calendario de la copropiedad</h3><div data-list></div></section>';
 const form=root.querySelector('form'),status=root.querySelector('[role=status]'),notice=root.querySelector('[data-notice]'),list=root.querySelector('[data-list]');
 notice.textContent=demo?'SIMULACIÓN LOCAL: citas en este navegador. No se enviarán invitaciones ni se modificará Google Calendar.':'CONECTIVIDAD PENDIENTE: evaluación por reglas solamente. La reserva real requiere backend transaccional y autorización.';
 let editing=null;
 function render(){
  list.replaceChildren();
  if(!demo){list.textContent='La agenda real estará disponible cuando se configure PostgreSQL QA.';return;}
  const rows=listDemoMeetings(projectId);
  if(!rows.length){list.textContent='Todavía no hay reuniones registradas para esta copropiedad.';return;}
  for(const m of rows){
   const item=document.createElement('article');item.className='panel';
   const title=document.createElement('h4');title.textContent=m.title;
   const desc=document.createElement('p');
   desc.textContent=new Date(m.start).toLocaleString('es-CO')+' → '+new Date(m.end).toLocaleString('es-CO')+' · '+m.priority.toUpperCase()+' · '+(m.management?'Gerencia requerida':'Sin Gerencia')+' · '+(m.status==='pending_management'?'Pendiente de aprobación 24 h':m.status==='cancelled'?'Cancelada':'Agendada (demo)');
   item.append(title,desc);
   if(m.status!=='cancelled'){
    const edit=document.createElement('button');edit.textContent='Reprogramar';edit.type='button';edit.onclick=()=>{
      editing=m.id;form.elements.subject.value=m.title;form.elements.start.value=localInput(m.start);
      form.elements.end.value=localInput(m.end);form.elements.priority.value=m.priority;
      form.elements.management.checked=m.management;status.textContent='Editando reunión '+m.title;form.scrollIntoView({block:'nearest'});
    };
    const cancel=document.createElement('button');cancel.textContent='Cancelar';cancel.type='button';cancel.onclick=()=>{
      cancelDemoMeeting(projectId,m.id);if(editing===m.id)editing=null;status.textContent='Cancelación local registrada.';render();
    };
    const google=document.createElement('button');google.type='button';google.textContent='Preparar en Google Calendar';google.onclick=()=>{
      const compact=iso=>new Date(iso).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
      const params=new URLSearchParams({action:'TEMPLATE',text:m.title,
        dates:compact(m.start)+'/'+compact(m.end),
        details:'Propuesta ADPHOR QA. Confirmar manualmente en Google Calendar. Gerencia: '+(m.management?'requerida':'no requerida')});
      window.open('https://calendar.google.com/calendar/render?'+params.toString(),'_blank','noopener,noreferrer');
    };
    item.append(edit,cancel,google);
   }
   list.append(item);
  }
 }
 function localInput(value){const d=new Date(value),adjusted=new Date(d.getTime()-d.getTimezoneOffset()*60000);return adjusted.toISOString().slice(0,16);}
 form.querySelector('[data-clear]').onclick=()=>{editing=null;form.reset();status.textContent='Nuevo horario.';};
 form.onsubmit=async e=>{
  e.preventDefault();const button=form.querySelector('button');button.disabled=true;status.textContent='Evaluando…';
  try{
   const data=new FormData(form);
   const assessment=await repo.assessMeeting(projectId,{subject:data.get('subject'),notes:data.get('notes'),management_requested:data.has('management')});
   if(!root.isConnected)return;
   if(!demo){status.textContent='Evaluación: '+assessment.priority_level+'. '+assessment.reason+'. No se agendó: backend pendiente.';return;}
   const clientTitle=buildClientMeetingTitle({type:data.get('meetingType'),subType:data.get('subType'),specification:data.get('specification'),property:projectId,modality:data.get('modality')});
   const startTime=new Date(data.get('start'));
   const duration=meetingDurationHours(data.get('meetingType'),data.get('duration'));
   const endTime=data.get('end')?new Date(data.get('end')):new Date(startTime.getTime()+duration*3600000);
   const result=scheduleDemoMeeting(projectId,{id:editing,title:clientTitle+' · '+data.get('subject'),start:startTime.toISOString(),end:endTime.toISOString(),priority:data.get('priority'),management:data.has('management')||assessment.requires_management});
   status.textContent=result.status==='pending_management'?'Solicitud registrada localmente, PENDIENTE DE APROBACIÓN GERENCIAL por ventana menor a 24 h. No constituye una reserva real.':'Reunión agendada en el calendario local de prueba. Sin invitaciones externas.';
   editing=null;form.reset();render();
  }catch(error){status.textContent=error.message;}finally{button.disabled=false;}
 };
 render();
}
