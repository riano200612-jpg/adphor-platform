// Miss ADPHOR — grounded, read-only assistant for the authenticated project.
// No network calls, model claims, background learning or cross-project access.
const normalized = s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
export function answerMissAdphor(question, context={}) {
 const q=normalized(question);
 const {project,projectId,tickets=[],role='viewer',mode='demo',availablePages=[]}=context;
 if(!project || !projectId || project.id!==projectId) return {text:'Selecciona una copropiedad autorizada para que pueda ayudarte.',page:null};
 const scoped=tickets.filter(t=>t.project_id===projectId);
 const name=String(project.name||'la copropiedad');
 const prefix=mode==='demo'?'Estos son datos demostrativos del navegador. ':'Esta respuesta utiliza únicamente los registros actualmente cargados para tu copropiedad. ';
 const go=(page,text)=>({text,page:availablePages.includes(page)?page:null});
 if(!q)return {text:'Pregúntame por pendientes, prioridades, bitácora, PQRS, reuniones o el enjambre.',page:null};
 if(/cerrar|aprobar|enviar|borrar|eliminar|asignar (un |una )?caso/.test(q))return {text:'Puedo orientarte y abrir el módulo correspondiente, pero no ejecuto cierres, aprobaciones, asignaciones ni notificaciones. Esas operaciones requieren permisos y revisión humana.',page:null};
 if(/pendient|vencid|atrasad|casos|novedad|mantenimiento|estado/.test(q)) {
  const active=scoped.filter(t=>!['cerrada','cerrado','closed'].includes(normalized(t.status)));
  const late=active.filter(t=>t.due_date && /^\d{4}-\d{2}-\d{2}$/.test(t.due_date) && t.due_date < new Date().toISOString().slice(0,10));
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
 if(/reunion|calendario|agenda|meet/.test(q))return go('meetings','Abre Reuniones para ver la agenda disponible. La sincronización con el calendario original de José todavía no está certificada.');
 if(/recorrido|inspeccion|visita/.test(q))return go('recorridos','En Recorridos puedes registrar una novedad, asignar seguimiento según tu rol y verificar avances. Las evidencias multimedia requieren almacenamiento privado.');
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
export function mountMissAdphorChat(host,{context,onNavigate}){
 const img='/assets/branding/miss-adphor.webp';
 host.innerHTML='<aside class="miss-chat" aria-label="Asistente Miss ADPHOR"><button type="button" class="miss-chat-toggle" aria-expanded="false"><img src="'+img+'" alt="" aria-hidden="true"> <span>Miss ADPHOR · Asistente</span></button><section class="miss-chat-panel" hidden><h2>Miss ADPHOR</h2><p class="miss-chat-disclaimer">Asistencia contextual de lectura · No ejecuta acciones ni entrena modelos.</p><div class="miss-chat-messages" role="log" aria-live="polite" aria-relevant="additions"></div><form class="miss-chat-form"><label for="miss-chat-question">¿En qué puedo ayudarte?</label><input id="miss-chat-question" maxlength="350" autocomplete="off" placeholder="Ej. ¿Cuántos casos pendientes hay?" required><button type="submit">Consultar</button></form><p class="miss-chat-quick"><button type="button" data-miss-question="¿Cuántos casos pendientes hay?">Pendientes</button><button type="button" data-miss-question="¿Cómo consulto PQRS?">PQRS</button><button type="button" data-miss-question="¿Qué hace el enjambre?">Enjambre</button></p></section></aside>';
 const toggle=host.querySelector('.miss-chat-toggle'),panel=host.querySelector('.miss-chat-panel'),log=host.querySelector('.miss-chat-messages'),form=host.querySelector('form'),input=form.querySelector('input');
 toggle.addEventListener('click',()=>{panel.hidden=!panel.hidden;toggle.setAttribute('aria-expanded',String(!panel.hidden));if(!panel.hidden)input.focus();});
 function append(text,who){const p=document.createElement('p');p.className='miss-chat-msg '+who;p.textContent=text;log.append(p);log.scrollTop=log.scrollHeight;}
 function ask(value){const question=String(value||'').trim();if(!question)return;append(question,'user');const result=answerMissAdphor(question,context());append(result.text,'assistant');if(result.page){const button=document.createElement('button');button.type='button';button.textContent='Abrir '+result.page;button.className='miss-chat-jump';button.onclick=()=>onNavigate(result.page);log.append(button);}input.value='';}
 form.addEventListener('submit',event=>{event.preventDefault();ask(input.value);});
 host.querySelectorAll('[data-miss-question]').forEach(b=>b.onclick=()=>ask(b.dataset.missQuestion));
 append('¡Hola! Soy Miss ADPHOR. Puedo orientarte usando los registros visibles de tu copropiedad.', 'assistant');
}
