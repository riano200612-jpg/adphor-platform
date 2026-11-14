import {bogotaAgendaDate} from './services/verified-agenda.js';
import {validateCalendarBusyIntervals} from './services/calendar-availability.js';
import {isMissOperationalQuestion,summarizeMissOperations,describeMissOperations} from './services/miss-operations-summary.js';
// Miss ADPHOR — grounded, read-only assistant for the authenticated project.
// No network calls, model claims, background learning or cross-project access.
const normalized = s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const moduleGuidance = {
 agenda:'Consulta las reuniones verificadas de la copropiedad seleccionada. Filtra por asunto, fecha de Colombia y estado. La carga es puntual. La reprogramación y cancelación corporativas aún no están conectadas en esta versión.',
 dashboard:'Selecciona una copropiedad asignada y revisa sus indicadores y reuniones verificadas. Para preparar una solicitud, abre Reuniones.',
 meetings:'Selecciona el tipo y revisa la duración. Elige un acompañante o «Sin acompañamiento requerido». Si está habilitada la consulta de Calendar, verifica el horario antes de revisar la solicitud. La revisión no crea una reserva.',
 pqrs:'Revisa los casos de la copropiedad seleccionada. Abre un expediente para consultar su estado e historial. Si puedes radicar, verifica los datos antes de enviar.',
 recorridos:'Consulta los recorridos de la copropiedad seleccionada. Si tu rol permite registrar un hallazgo, indica su ubicación y revisa el formulario antes de guardar.',
 staff:'Consulta el equipo visible para la copropiedad seleccionada. En Reuniones puedes revisar las opciones de acompañamiento.',
};

export function answerMissAdphor(question, context={}) {
 const q=normalized(question);
 const {project,projectId,tickets=[],role='viewer',mode='demo',availablePages=[]}=context;
 if(!project || !projectId || project.id!==projectId) return {text:'Selecciona una copropiedad autorizada para que pueda ayudarte.',page:null};
 const scoped=tickets.filter(t=>t.project_id===projectId);
 const name=String(project.name||'la copropiedad');
 const prefix=mode==='demo'?'Estos son datos demostrativos del navegador. ':'Esta respuesta utiliza únicamente los registros actualmente cargados para tu copropiedad. ';
 const go=(page,text)=>({text,page:availablePages.includes(page)?page:null});
 if(/^(?:como uso este modulo|ayuda de este modulo|que puedo hacer aqui)$/.test(q.replace(/[¿?]/g,'').trim())){
  const guidance=availablePages.includes(context.page) && Object.hasOwn(moduleGuidance,context.page)
   ? moduleGuidance[context.page] : 'Elige un módulo visible en la navegación para consultar su guía.';
  return {text:guidance,page:null};
 }
 if(!q)return {text:'Pregúntame por pendientes, prioridades, bitácora, PQRS, reuniones o el enjambre.',page:null};
 if(/cerrar|aprobar|enviar|borrar|eliminar|asignar (un |una )?caso/.test(q))return {text:'Puedo orientarte y abrir el módulo correspondiente, pero no ejecuto cierres, aprobaciones, asignaciones ni notificaciones. Esas operaciones requieren permisos y revisión humana.',page:null};
 if(/\b(?:agendar|programar|crear|preparar)\b.*\breunion(?:es)?\b/.test(q)){
  return go('meetings',`Para preparar una reunión en ${name}, abre Reuniones y selecciona tipo, duración y acompañamiento. Allí puedes evaluar la solicitud. La disponibilidad en vivo y la creación en Google Calendar aún no están habilitadas desde el asistente.`);
 }
 if(/pendient|vencid|atrasad|casos|novedad|mantenimiento|estado/.test(q)) {
  const active=scoped.filter(t=>!['cerrada','cerrado','closed'].includes(normalized(t.status)));
  const late=active.filter(t=>t.due_date && /^\d{4}-\d{2}-\d{2}$/.test(t.due_date) && isPastBogotaDay(t.due_date,context.now ?? Date.now()));
  return go('tickets',prefix+`En ${name} hay ${scoped.length} casos visibles: ${active.length} sin cerrar y ${late.length} con fecha vencida según los registros cargados. Abre la Bitácora para revisar el detalle.`);
 }
 if(/prioridad|urgente|alta/.test(q)){
  const high=scoped.filter(t=>['alta','urgente','critica'].includes(normalized(t.priority)));
  return go('tickets',prefix+`En ${name} veo ${high.length} casos de prioridad alta o urgente entre ${scoped.length} registros visibles. Las prioridades deben verificarse antes de actuar.`);
 }
 if(/copropiedad|propiedad|donde estoy|mi comunidad/.test(q))return {text:prefix+`Estás consultando ${name}. Solo puedo utilizar datos que tu sesión ya tiene autorizados.`,page:null};

  // ADPHOR_NAV_GUIDE_V1
  if(/^(inicio|home|dashboard|ir al inicio|volver al inicio|llevame al inicio)$/.test(q))
    return go('dashboard','Te acompaño al inicio de ADPHOR.');

  if(/copropiedades|ver propiedades|catalogo/.test(q))
    return go('properties','Te acompaño al catálogo de copropiedades.');

  if(/mis tareas|mis actividades|trabajo asignado/.test(q))
    return go('tickets','Te acompaño a la Bitácora.');

  if(/centro integrado|centro de operaciones/.test(q))
    return go('unified','Te acompaño al Centro integrado de ADPHOR.');
 if(/pqrs|peticion|reclamo|queja|sugerencia/.test(q))return go('pqrs','Abre PQRS para registrar o consultar solicitudes. La carga real de archivos sigue pendiente de habilitar Storage privado; no confirmaré adjuntos que no se hayan guardado.');
 if(/\bagenda\b/.test(q)&&availablePages.includes('agenda'))return go('agenda','Abre Agenda para consultar las reuniones verificadas de tu copropiedad. La importación es puntual; no confirma cambios recientes del calendario.');
 if(/reunion|calendario|agenda|meet/.test(q))return go('meetings','Abre Reuniones para ver la agenda disponible. La sincronización con el calendario original de José todavía no está certificada.');
 if(/\bvisitas?\b/.test(q))return go('visits','En Visitas puedes revisar operaciones y evidencias según tu rol y MFA AAL2. Solo los registros confirmados por Supabase QA se consideran persistidos.');
 if(/recorrido|inspeccion/.test(q))return go('recorridos','En Recorridos puedes registrar una novedad, asignar seguimiento según tu rol y verificar avances. Las evidencias multimedia requieren almacenamiento privado.');
 if(/enjambre|agente|inteligencia|informe ia|modelo|miss adphor/.test(q)){
  if(!['admin','coordinator'].includes(role))return {text:'Soy Miss ADPHOR, la interfaz de asistencia de la plataforma. Puedo orientarte sobre tus solicitudes autorizadas, pero los análisis internos del enjambre son exclusivos de Administración y Coordinación. Mis respuestas actuales son reglas, no un modelo entrenado.',page:null};
  return go('agent-history','Soy Miss ADPHOR, la interfaz unificada del enjambre de Operaciones, Análisis e Informes. Puedes consultar ejecuciones y borradores autorizados en Historial del enjambre. El análisis por reglas está disponible; no hay un modelo entrenado validado en producción. Ningún agente cierra casos ni envía informes automáticamente.');
 }
 if(/informe|reporte|grafica/.test(q))return go('reports','Abre Informes para consultar los indicadores disponibles de la copropiedad seleccionada. Comprueba período y origen antes de presentar resultados.');
 if(/soy (propietario|copropietario)|residente|administracion|gerencia|gerente|coordinador|tecnico/.test(q)){
   if(['admin','coordinator'].includes(role))return {text:'Te acompaño en la gestión administrativa de '+name+'. Puedes consultar bitácoras, reuniones, indicadores y el historial de análisis. Las decisiones finales requieren autorización humana.',page:null};
   if(role==='technician')return {text:'Te ayudo a revisar tareas y novedades de '+name+'. Las asignaciones y cierres requieren los permisos de tu cargo.',page:null};
   return {text:'Puedo guiarte por las opciones que tu sesión tenga autorizadas en '+name+'. No tengo acceso a expedientes o análisis de otras personas.',page:null};
 }
 if(/permiso|rol|puedo hacer/.test(q))return {text:`Tu rol actual es ${role}. Los permisos de escritura se verifican en el backend; yo solo puedo orientarte.`,page:null};
 return {text:'Puedo ayudarte con Bitácora, PQRS, Recorridos, Reuniones, Informes y el enjambre. No tengo una respuesta verificada para esa consulta; reformúlala o abre el módulo correspondiente.',page:null};
}
// A date-only deadline expires after the Colombia calendar day has ended.
export function isPastBogotaDay(value,now=Date.now()) {
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const parsed=new Date(value+'T00:00:00Z');
 if(!Number.isFinite(parsed.getTime())||parsed.toISOString().slice(0,10)!==value)return false;
 const today=bogotaAgendaDate(now);
 return Boolean(today)&&value<today;
}
export function verifiedMissMeetings(rows,projectId) {
 if(!projectId||!Array.isArray(rows))throw Error('Respuesta de reuniones no válida.');
 const scoped=rows.filter(row=>row?.project_id===projectId&&row.is_calendar_verified===true&&row.source_status==='Confirmada');
 if(scoped.some(row=>!row.title||!Number.isFinite(Date.parse(row.start_at))))throw Error('Horario de reunión no válido.');
 return [...scoped].sort((a,b)=>Date.parse(a.start_at)-Date.parse(b.start_at));
}
// Exact-intent read-only questions: never infer private data from a generic prompt.
export function isMissVisitQuestion(question) {
 const q=normalized(question).replace(/[¿?]/g,'').replace(/\s+/g,' ').trim();
 return /^(?:miss adphor,? )?(?:cuantas visitas (?:hay|tenemos|tiene esta copropiedad)|estado de las visitas(?: de esta copropiedad)?|mis visitas|visitas pendientes(?: de esta copropiedad)?)$/.test(q);
}
export function summarizeMissVisits(rows,projectId){
 const allowed=['programada','en_ejecucion','completada','cancelada'];
 if(typeof projectId!=='string'||!projectId||!Array.isArray(rows)||rows.length>5000||
   rows.some(row=>!row||row.project_id!==projectId||!allowed.includes(row.status)))
  throw Error('Consulta de Visitas no verificable.');
 return {
  total:rows.length,
  scheduled:rows.filter(row=>row.status==='programada').length,
  active:rows.filter(row=>row.status==='en_ejecucion').length,
  completed:rows.filter(row=>row.status==='completada').length,
  cancelled:rows.filter(row=>row.status==='cancelada').length
 };
}
export function isMissCorporateAvailabilityQuestion(question){
 const q=normalized(question).replace(/[¿?]/g,'').replace(/\s+/g,' ').trim();
 return /^(?:miss adphor,? )?(?:disponibilidad corporativa|disponibilidad del calendario corporativo|horarios ocupados del calendario corporativo|como esta la disponibilidad corporativa)$/.test(q);
}
export function isPqrsAttentionQuestion(question) {
 return /^(?:miss adphor,? *)?que asuntos(?: importantes)? requieren mi atencion hoy$/.test(
  normalized(question).replace(/[¿?]/g,'').trim()
 );
}
export function summarizePqrsAttention(rows,projectId,now=Date.now()){
 const open=rows.filter(row=>row.project_id===projectId && ['open','assigned','in_progress'].includes(row.status));
 const overdue=open.filter(row=>Number.isFinite(Date.parse(row.due_at)) && Date.parse(row.due_at)<now);
 const opened=open.filter(row=>row.status==='open').length;
 return {open:opened,inProgress:open.length-opened,overdue:overdue.length,overdueIds:overdue.map(row=>row.id)};
}
export function mountMissAdphorChat(host,{context,onNavigate,loadPqrs,loadMeetings,loadVisits,loadCalendarBusy}){
 const img='/assets/branding/miss-adphor.webp';
 host.innerHTML='<aside class="miss-chat" aria-label="Asistente Miss ADPHOR"><button type="button" class="miss-chat-toggle" aria-expanded="false"><img src="'+img+'" alt="" aria-hidden="true"> <span>Miss ADPHOR · Asistente</span></button><section class="miss-chat-panel" hidden><h2>Miss ADPHOR</h2><p class="miss-chat-disclaimer">Asistencia contextual de lectura · No ejecuta acciones ni entrena modelos.</p><div class="miss-chat-messages" role="log" aria-live="polite" aria-relevant="additions"></div><form class="miss-chat-form"><label for="miss-chat-question">¿En qué puedo ayudarte?</label><input id="miss-chat-question" maxlength="350" autocomplete="off" placeholder="Ej. ¿Cuántos casos pendientes hay?" required><button type="submit">Consultar</button></form><p class="miss-chat-quick"><button type="button" data-miss-question="¿Cómo uso este módulo?">Ayuda de este módulo</button><button type="button" data-miss-question="¿Cuántos casos pendientes hay?">Pendientes</button><button type="button" data-miss-question="¿Qué asuntos importantes requieren mi atención hoy?">Atención hoy</button><button type="button" data-miss-question="¿Cómo consulto PQRS?">PQRS</button><button type="button" data-miss-question="¿Cuántas visitas tiene esta copropiedad?">Visitas reales</button><button type="button" data-miss-question="Disponibilidad corporativa">Disponibilidad corporativa</button><button type="button" data-miss-question="Panorama operativo">Panorama integral</button><button type="button" data-miss-question="¿Qué hace el enjambre?">Enjambre</button></p></section></aside>';
 const toggle=host.querySelector('.miss-chat-toggle'),panel=host.querySelector('.miss-chat-panel'),log=host.querySelector('.miss-chat-messages'),form=host.querySelector('form'),input=form.querySelector('input');
 toggle.addEventListener('click',()=>{panel.hidden=!panel.hidden;toggle.setAttribute('aria-expanded',String(!panel.hidden));if(!panel.hidden)input.focus();});
 function append(text,who){const p=document.createElement('p');p.className='miss-chat-msg '+who;p.textContent=text;log.append(p);log.scrollTop=log.scrollHeight;}
 async function ask(value){
  const question=String(value||'').trim();
  if(!question)return;
  append(question,'user');input.value='';
  const current=context();
  let result=answerMissAdphor(question,current);
  if(isPqrsAttentionQuestion(question) && current.project?.id===current.projectId && current.projectId){
   result={text:'La consulta de atención requiere PQRS habilitado en QA.',page:null};
   if(loadPqrs){
    try{
     const rows=await loadPqrs(current.projectId);
     const summary=summarizePqrsAttention(rows,current.projectId);
     const references=summary.overdueIds.slice(0,5).join(', ');
     result={text:`PQRS de esta copropiedad · ${summary.open} abiertas · ${summary.inProgress} en gestión · ${summary.overdue} vencidas.`+(references ? ' Radicados vencidos (hasta 5): '+references+'.' : ''),page:'pqrs'};
    }catch{result={text:'No pude verificar las PQRS de esta copropiedad. Revisa tu sesión o abre el módulo.',page:null};}
   }
  }
  if (/^que reuniones verificadas tiene esta copropiedad$/.test(normalized(question).replace(/[¿?]/g,'').trim()) &&
      current.project?.id===current.projectId && current.projectId) {
   result={text:'No dispongo de una fuente de reuniones verificadas para esta consulta.',page:null};
   if (loadMeetings) {
    try {
     const rows=verifiedMissMeetings(await loadMeetings(current.projectId),current.projectId);
     const date=new Intl.DateTimeFormat('es-CO',{dateStyle:'medium',timeStyle:'short',timeZone:'America/Bogota'});
     const details=rows.slice(0,5).map(row=>row.title+' · '+date.format(new Date(row.start_at))).join(' / ');
     result={text:(rows.length ? `${rows.length} reuniones verificadas. ${details}.` : 'No hay reuniones verificadas para esta copropiedad en la carga disponible.')+
       ' Fuente: calendario corporativo de ADPHOR, importación puntual. Consulta Reuniones para ver el detalle.',page:'meetings'};
    } catch {
     result={text:'No pude verificar las reuniones de esta copropiedad.',page:null};
    }
   }
  }
  if(isMissVisitQuestion(question) && current.project?.id===current.projectId && current.projectId){
   result={text:'No hay una consulta de Visitas autorizada disponible para esta sesión.',page:null};
   if(current.mode==='cloud' && loadVisits){
    try{
     const summary=summarizeMissVisits(await loadVisits(current.projectId),current.projectId);
     result={text:'Visitas registradas en Supabase QA para esta copropiedad: '+summary.total+
      ' · Programadas: '+summary.scheduled+' · En ejecución: '+summary.active+
      ' · Completadas: '+summary.completed+' · Canceladas: '+summary.cancelled+
      '. Consulta puntual bajo la sesión y permisos vigentes; no es una simulación.',page:'visits'};
    }catch{
     result={text:'No pude verificar las Visitas de esta copropiedad. Revisa tu sesión y MFA AAL2.',page:null};
    }
   }
  }
  if(isMissCorporateAvailabilityQuestion(question) && current.project?.id===current.projectId && current.projectId){
   result={text:'La disponibilidad corporativa requiere una sesión administrativa autorizada y MFA AAL2.',page:null};
   if(current.mode==='cloud' && ['admin','coordinator'].includes(current.role)){
    if(!loadCalendarBusy)result={text:'La consulta de Google Calendar todavía no está habilitada en ADPHOR QA. La conexión de ChatGPT es independiente.',page:null};
    else{
     try{
      const now=Number.isFinite(current.now)?current.now:Date.now();
      const start=new Date(now).toISOString();
      const end=new Date(now+7*86400000).toISOString();
      const busy=validateCalendarBusyIntervals(await loadCalendarBusy(current.projectId,start,end));
      if(busy.length>1000)throw Error('Respuesta demasiado amplia.');
      result={text:'Google Calendar corporativo configurado en ADPHOR: '+busy.length+
        ' intervalos ocupados en los próximos 7 días. Fuente: consulta freeBusy en vivo; no revela asuntos ni participantes, no confirma reservas y no atribuye eventos a esta copropiedad.',page:'meetings'};
     }catch{
      result={text:'No pude comprobar la disponibilidad corporativa en vivo. No se confirman horarios libres ni reservas.',page:null};
     }
    }
   }
  }
  if(isMissOperationalQuestion(question) && current.project?.id===current.projectId && current.projectId){
   result={text:'El panorama integral requiere una sesión de Administración o Coordinación en ADPHOR.',page:null};
   if(current.mode==='cloud' && ['admin','coordinator'].includes(current.role)){
    if(!loadPqrs||!loadVisits||!loadMeetings){
     result={text:'Faltan fuentes autorizadas para generar el panorama. No presentaré datos incompletos como un informe verificado.',page:null};
    }else{
     try{
      const [pqrs,visits,meetings]=await Promise.all([
       loadPqrs(current.projectId),loadVisits(current.projectId),loadMeetings(current.projectId)
      ]);
      const summary=summarizeMissOperations({
       projectId:current.projectId,tickets:current.tickets,pqrs,visits,meetings,now:current.now??Date.now()
      });
      result={text:describeMissOperations(summary),page:null};
     }catch{
      result={text:'No pude verificar todas las fuentes para esta copropiedad. No se generó un panorama incompleto; revisa sesión, MFA AAL2 y permisos.',page:null};
     }
    }
   }
  }
  if(!host.isConnected||context().projectId!==current.projectId||context().userId!==current.userId)return;
  append(result.text,'assistant');
  if(result.page && current.availablePages.includes(result.page)){
   const button=document.createElement('button');button.type='button';button.textContent='Abrir '+result.page;button.className='miss-chat-jump';button.onclick=()=>onNavigate(result.page);log.append(button);
  }
 }
 form.addEventListener('submit',event=>{event.preventDefault();ask(input.value);});
 host.querySelectorAll('[data-miss-question]').forEach(b=>b.onclick=()=>ask(b.dataset.missQuestion));
 append('¡Hola! Soy Miss ADPHOR. Puedo orientarte usando los registros visibles de tu copropiedad.', 'assistant');
}
