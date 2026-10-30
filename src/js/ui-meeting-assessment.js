import {listDemoMeetings,scheduleDemoMeeting,cancelDemoMeeting} from './services/demo-calendar.js';

// This is an interactive local calendar in DEMO mode. Cloud mode remains assessment-only
// until authenticated transactional booking is verified on isolated QA PostgreSQL.
export function mountMeetingAssessment(root,{repo,projectId}) {
 const demo=repo.mode==='demo-calendar';
 root.innerHTML='<section class="panel"><h2>Reuniones y agenda gerencial</h2><p data-notice></p><form><label>Asunto<input name="subject" required minlength="3" maxlength="200"></label><label>Notas<textarea name="notes" maxlength="5000"></textarea></label><label>Inicio<input name="start" type="datetime-local" required></label><label>Fin<input name="end" type="datetime-local" required></label><label>Prioridad<select name="priority"><option value="bajo">Baja</option><option value="medio" selected>Media</option><option value="alto">Alta</option></select></label><label><input name="management" type="checkbox"> Solicitar asistencia de Gerencia</label><button>Evaluar y agendar</button><button type="button" data-clear>Nuevo horario</button></form><p role="status"></p><h3>Calendario de la copropiedad</h3><div data-list></div></section>';
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
    item.append(edit,cancel);
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
   const result=scheduleDemoMeeting(projectId,{id:editing,title:data.get('subject'),start:data.get('start'),end:data.get('end'),priority:data.get('priority'),management:data.has('management')||assessment.requires_management});
   status.textContent=result.status==='pending_management'?'Solicitud registrada localmente, PENDIENTE DE APROBACIÓN GERENCIAL por ventana menor a 24 h. No constituye una reserva real.':'Reunión agendada en el calendario local de prueba. Sin invitaciones externas.';
   editing=null;form.reset();render();
  }catch(error){status.textContent=error.message;}finally{button.disabled=false;}
 };
 render();
}
