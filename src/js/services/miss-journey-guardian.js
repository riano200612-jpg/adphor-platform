/**
 * Miss ADPHOR Guardian V1 — navigation-only process guide for QA Integral.
 *
 * Two deterministic, separately implemented reviewers validate the shortest
 * authorized path. No background process, model, network, training, mutation,
 * persistence, approval, calendar booking or cross-tenant reads.
 */
const PROCEDURES = Object.freeze({
  dashboard: ['Resumen', 'Revisa las prioridades y el origen de los indicadores.', 'Contrasta las cifras con el módulo operativo correspondiente.'],
  properties: ['Copropiedades', 'Selecciona únicamente una copropiedad asignada a tu usuario.', 'Comprueba que el encabezado y el contexto coinciden con la selección.'],
  unified: ['Centro integrado', 'Revisa los indicadores disponibles y sus fuentes declaradas.', 'Abre el módulo de origen para verificar cualquier alerta.'],
  tickets: ['Bitácora', 'Filtra los casos por estado, responsable y plazo.', 'Abre el expediente y revisa su historial antes de cualquier cambio.'],
  mine: ['Mis tareas', 'Consulta las actividades asignadas a tu cuenta.', 'Revisa su prioridad y evidencia antes de actualizar el estado.'],
  areas: ['Áreas', 'Consulta las áreas visibles para tu copropiedad.', 'Verifica los responsables y el alcance antes de escalar una novedad.'],
  pqrs: ['PQRS', 'Consulta el expediente o prepara una solicitud con asunto, descripción y evidencia.', 'Revisa la copropiedad, el destinatario aprobado y los adjuntos confirmados en Storage privado.'],
  visits: ['Visitas', 'Consulta las visitas o prepara una nueva con motivo, responsable y fecha.', 'Verifica la persistencia en Supabase QA y el estado de las evidencias privadas.'],
  recorridos: ['Recorridos', 'Ubica el recorrido y registra únicamente hallazgos autorizados.', 'Verifica ubicación y soportes antes de guardar mediante el módulo.'],
  meetings: ['Reuniones', 'Selecciona el tipo, duración y acompañamiento necesario.', 'Comprueba la disponibilidad corporativa solo si la consulta protegida está habilitada; no supone reserva.'],
  agenda: ['Agenda', 'Consulta las reuniones importadas y su fecha de corte.', 'Distingue una importación puntual de una sincronización de Google Calendar en vivo.'],
  reports: ['Informes', 'Selecciona la copropiedad y el período de referencia.', 'Comprueba conciliación, fuentes y estado de aprobación antes de compartir un informe.'],
  staff: ['Equipo administrativo', 'Consulta únicamente el personal permitido por la sesión.', 'Verifica rol y asignación sin asumir permisos de edición.'],
  'corporate-staff': ['Equipo corporativo', 'Consulta el equipo visible para tu rol.', 'Contrasta disponibilidad y asignaciones antes de solicitar acompañamiento.'],
  'agent-history': ['Historial del enjambre', 'Revisa el estado de las ejecuciones previamente registradas.', 'Confirma que cada resultado tenga fuente y aprobación verificables; esta guía no ejecuta agentes.'],
  consultation: ['Consulta de datos', 'Selecciona la fuente disponible y el alcance de la copropiedad.', 'Verifica si la fuente es sintética o certificada antes de citar resultados.'],
  'qa-source': ['Auditoría histórica', 'Comprueba las diferencias de origen bajo la sesión administrativa.', 'No corrijas ni sobrescribas archivos originales desde esta guía.'],
  'access-audit': ['Usuarios y permisos', 'Consulta el estado de los usuarios y sus permisos vigentes.', 'Cualquier alta, baja o cambio exige controles administrativos en el servidor.'],
});
const SENSITIVE = new Set(['tickets','mine','pqrs','visits','recorridos','meetings','reports','agent-history','qa-source','access-audit']);
const MANAGER_ONLY = new Set(['agent-history','consultation']);
const ADMIN_ONLY = new Set(['qa-source','access-audit']);
const ORDER = Object.freeze(['scope','open','inspect','confirm']);
const EXTRA = 'crosscheck';
const ALLOWED = new Set([...ORDER,EXTRA]);
const ALIASES = Object.freeze({
  pqrs:'pqrs', visitas:'visits', visita:'visits', reuniones:'meetings', reunion:'meetings',
  bitacora:'tickets', recorridos:'recorridos', recorrido:'recorridos',
  agenda:'agenda', informes:'reports', informe:'reports',
  permisos:'access-audit', usuarios:'access-audit',
  tareas:'mine', resumen:'dashboard', copropiedades:'properties',
  personal:'staff', equipo:'staff', enjambre:'agent-history',
});
const normalize=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .toLowerCase().replace(/[¿?!.]/g,'').replace(/\s+/g,' ').trim();

export function isMissJourneyRequest(value){
  const q=normalize(value);
  return /^(?:(?:miss adphor[, ]*)?)(?:guiame(?: paso a paso)?|guia(?: paso a paso)?|siguiente paso|cual es el siguiente paso|que hago ahora|acompaname(?: paso a paso)?|ayudame paso a paso)(?: (?:en|para|con|sobre) (?:el |la |las |los )?(?:modulo de |modulo )?(?:pqrs|visitas|visita|reuniones|reunion|bitacora|recorridos|recorrido|agenda|informes|informe|permisos|usuarios|tareas|resumen|copropiedades|personal|equipo|enjambre))?$/.test(q);
}

function targetFromRequest(value,currentPage){
  const q=normalize(value);
  const match=q.match(/(?:en|para|con|sobre) (?:el |la |las |los )?(?:modulo de |modulo )?([a-z]+)$/);
  return match ? ALIASES[match[1]]??currentPage : currentPage;
}

function qualityReview(stages,requiredExtra){
  const unique=stages.length===new Set(stages).size;
  const essential=ORDER.every(x=>stages.includes(x));
  const order=stages[0]==='scope' && stages.at(-1)==='confirm' &&
    stages.indexOf('scope')<stages.indexOf('open') &&
    stages.indexOf('open')<stages.indexOf('inspect') &&
    stages.indexOf('inspect')<stages.indexOf('confirm');
  const reviewed=!requiredExtra || (stages.includes(EXTRA) &&
    stages.indexOf(EXTRA)>stages.indexOf('inspect') &&
    stages.indexOf(EXTRA)<stages.indexOf('confirm'));
  const accepted=unique&&essential&&order&&reviewed;
  return {accepted,unique,essential,order,reviewed};
}

function safetyReview(page,stages,context){
  const scope=context.project?.id===context.projectId && !!context.projectId;
  const visible=Array.isArray(context.availablePages)&&context.availablePages.includes(page);
  const role=typeof context.role==='string'?context.role:'';
  const allowedRole=!ADMIN_ONLY.has(page) || role==='admin';
  const management=!MANAGER_ONLY.has(page) || role==='admin'||role==='coordinator';
  const known=Object.hasOwn(PROCEDURES,page)&&stages.every(x=>ALLOWED.has(x));
  const noExecution=context.externalEffect!==true && context.execute!==true;
  const noCrossTenant=context.requestedProjectId===undefined||context.requestedProjectId===context.projectId;
  const accepted=scope&&visible&&allowedRole&&management&&known&&noExecution&&noCrossTenant;
  return {accepted,scope,visible,allowedRole,management,known,noExecution,noCrossTenant};
}

function qualityChecksSafety(page,stages,context,safety){
  const isVisible=Array.isArray(context.availablePages)&&context.availablePages.indexOf(page)>=0;
  return safety.scope===(context.project?.id===context.projectId&&!!context.projectId) &&
    safety.visible===isVisible && safety.known===(Object.hasOwn(PROCEDURES,page)&&stages.every(s=>ALLOWED.has(s))) &&
    safety.noExecution===(context.execute!==true&&context.externalEffect!==true) &&
    safety.noCrossTenant===(context.requestedProjectId===undefined||context.requestedProjectId===context.projectId);
}
function safetyChecksQuality(stages,requiredExtra,quality){
  const expected=ORDER.every(x=>stages.includes(x)) &&
    stages.length===new Set(stages).size &&
    stages[0]==='scope' && stages.at(-1)==='confirm' &&
    stages.indexOf('scope')<stages.indexOf('open') &&
    stages.indexOf('open')<stages.indexOf('inspect') &&
    stages.indexOf('inspect')<stages.indexOf('confirm') &&
    (!requiredExtra||stages.indexOf(EXTRA)>stages.indexOf('inspect')&&stages.indexOf(EXTRA)<stages.indexOf('confirm'));
  return quality.accepted===expected;
}
function block(text){
  return Object.freeze({text,page:null,certified:false,externalActions:false,modelEvaluated:false});
}

export function guideMissJourney(context={},request='Guíame paso a paso'){
  if(!isMissJourneyRequest(request))return block('No pude identificar un recorrido guiado. Prueba «Guíame paso a paso».');
  const page=targetFromRequest(request,context.page);
  if(!Object.hasOwn(PROCEDURES,page))return block('Abre un módulo autorizado de ADPHOR para que pueda guiarte.');
  if(!['cloud','demo'].includes(context.mode))return block('No hay una sesión de trabajo verificable para esta guía.');
  if(!Array.isArray(context.availablePages)||context.availablePages.length>40 ||
     context.availablePages.some(x=>typeof x!=='string')){
    return block('No se puede verificar la navegación permitida de esta sesión.');
  }
  const risk=SENSITIVE.has(page);
  const candidates=[ORDER,[ORDER[0],ORDER[1],ORDER[2],EXTRA,ORDER[3]]];
  const reviews=candidates.map(stages=>{
    const quality=qualityReview(stages,risk);
    const safety=safetyReview(page,stages,context);
    return {
      stages,
      quality,
      safety,
      crossQuality:qualityChecksSafety(page,stages,context,safety),
      crossSafety:safetyChecksQuality(stages,risk,quality),
    };
  });
  const allowed=reviews.filter(r=>r.quality.accepted&&r.safety.accepted&&r.crossQuality&&r.crossSafety)
    .sort((a,b)=>a.stages.length-b.stages.length);
  if(!allowed.length)return block('No puedo verificar tus permisos o la ruta segura de este módulo. Revisa la copropiedad y tu sesión.');
  const [title,task,verification]=PROCEDURES[page];
  const actions={
    scope:'Comprueba que estás en la copropiedad correcta y que tu sesión mantiene los permisos exigidos.',
    open:'Abre '+title+' desde la navegación autorizada.',
    inspect:task,
    crosscheck:'Antes de cualquier operación, revisa permisos, datos y destinatarios; los controles del servidor deciden si puede ejecutarse.',
    confirm:verification+' Comprueba el estado confirmado en el módulo; esta guía no guarda ni envía información.',
  };
  const steps=allowed[0].stages.map((id,i)=>String(i+1)+'. '+actions[id]);
  const prefix=context.mode==='demo'?'Modo demostración: no uses información real. ':'Guía contextual sobre tu sesión: no certifica que el sistema haya completado una operación. ';
  return Object.freeze({
    text:prefix+'Recorrido de '+title+':\n'+steps.join('\n')+
      '\nRevisión cruzada de calidad y seguridad: ruta de orientación aprobada, sin ejecutar acciones.',
    page, certified:true, externalActions:false,modelEvaluated:false,
    review:{quality:true,safety:true,mutual:true,steps:allowed[0].stages.length},
  });
}
