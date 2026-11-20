// Deterministic QA observers — these are NOT trained ML/DL/PLN models.
// They read the current authorized tenant's data through existing permissions;
// never call mutation, message, schedule, upload, approval or training endpoints.
export const QA_DIAGNOSTIC_HOST='qa-integral-claude-reviewed.adphor-platform.pages.dev';
const PROJECT=/^[A-Za-z0-9_-]{1,100}$/;
const ROLES=new Set(['admin','coordinator']);
const STATUS=new Set(['ok','attention','blocked']);

export function qaDiagnosticAllowed({hostname,mode,role,userId,projectId,authorizedProjects}={}) {
  return hostname===QA_DIAGNOSTIC_HOST && mode==='cloud' && ROLES.has(role)
    && typeof userId==='string' && userId.length>0
    && typeof projectId==='string' && PROJECT.test(projectId)
    && Array.isArray(authorizedProjects)
    && authorizedProjects.includes(projectId);
}
function result(id,label,status,detail,now){
  if(!STATUS.has(status))throw Error('Estado de auditoría inválido');
  return Object.freeze({id,label,status,detail,checkedAt:now()});
}
export async function runQaDiagnosticAgents(context, {onStep=()=>{},now=()=>new Date().toISOString()}={}) {
  const steps=[];
  const push=(id,label,status,detail)=>{
    const entry=result(id,label,status,detail,now);
    steps.push(entry);onStep(entry);
  };
  if(!qaDiagnosticAllowed(context)){
    push('acceso','Agente de permisos','blocked',
      'La ronda necesita una sesión QA Integral de Administración o Coordinación y una copropiedad autorizada.');
    return Object.freeze({mode:'diagnostico_qa_solo_lectura',steps});
  }
  const {repo,projectId,role,corporateAdmin=false,tickets=[],availablePages=[],missReady=false}=context;
  // This protected API verifies the user's current Supabase identity and MFA AAL2.
  // Fail closed BEFORE examining private organizational data.
  let readiness;
  try {
    if(typeof repo?.agentReadiness!=='function')throw Error('No hay lector autenticado');
    readiness=await repo.agentReadiness(projectId);
    if(readiness?.registry_ready!==true)throw Error('Registro no verificado');
    push('acceso','Agente de permisos','ok',
      'Lectura autorizada en el registro QA mediante sesión y MFA AAL2. Cloudflare Access externo se certifica por separado.');
  } catch {
    push('acceso','Agente de permisos','blocked',
      'No se comprobó la sesión MFA AAL2 y el registro protegido. No se leen otros datos.');
    return Object.freeze({mode:'diagnostico_qa_solo_lectura',steps});
  }

  const cases=Array.isArray(tickets)?tickets:[];
  const foreign=cases.filter(t=>!t||t.project_id!==projectId);
  const incomplete=cases.filter(t=>!t||typeof t.id!=='string'||!t.id||typeof t.status!=='string'||!t.status);
  if(foreign.length||incomplete.length) {
    push('operaciones','Agente de operaciones','attention',
      'El conjunto cargado contiene registros fuera de la copropiedad o incompletos. Requiere revisión humana.');
  }else{
    const open=cases.filter(t=>t.status!=='Cerrada').length;
    const noOwner=cases.filter(t=>t.status!=='Cerrada'&&!t.assignee).length;
    push('operaciones','Agente de operaciones',noOwner?'attention':'ok',
      'Bitácora autorizada: '+cases.length+' casos; '+open+' no cerrados; '+noOwner+' sin responsable. No se modifica ningún caso.');
  }

  if(role==='admin'&&corporateAdmin&&typeof repo?.corporateStaffDirectory==='function'){
    try {
      const staff=await repo.corporateStaffDirectory();
      if(!Array.isArray(staff))throw Error('Respuesta inválida');
      const active=staff.filter(p=>p?.active!==false);
      const withPhoto=active.filter(p=>typeof p.photo_path==='string'&&p.photo_path.length>0).length;
      push('equipo','Agente de equipo',withPhoto===active.length?'ok':'attention',
        'Directorio corporativo autorizado: '+active.length+' colaboradores activos; '+withPhoto+
        ' con foto; '+(active.length-withPhoto)+' pendientes. No se muestran imágenes ni datos personales.');
    }catch{
      push('equipo','Agente de equipo','blocked',
        'No se pudo consultar el directorio con los permisos actuales; no se intenta elevar privilegios.');
    }
  }else{
    push('equipo','Agente de equipo','blocked',
      'La consulta corporativa requiere una autorización de administrador general verificada.');
  }

  const required=['agent-history','pqrs','meetings','visits'];
  const missing=required.filter(p=>!availablePages.includes(p));
  push('modulos','Agente de navegación',missing.length?'attention':'ok',
    missing.length?'Hay módulos no visibles en este perfil; comprobar sus permisos por separado.'
      :'Accesos de Enjambre, PQRS, Reuniones y Visitas visibles. Esto no certifica transacciones externas.');

  push('miss','Agente de Miss ADPHOR',missReady?'ok':'attention',
    missReady?'Contenedor de Miss ADPHOR presente. Su respuesta conversacional y los servicios externos requieren pruebas aparte.'
      :'No se encontró el contenedor de Miss ADPHOR en esta vista.');

  const inferenceReady=readiness.models_ready===true;
  const rulesReady=readiness.rules_ready===true;
  push('motor','Agente supervisor','blocked',
    !inferenceReady&&!rulesReady?
      'Enjambre ML/DL/PLN y ejecución por reglas deshabilitados: no se han enviado tareas ni creado borradores.'
      :'El servicio reporta capacidades adicionales; requieren certificación independiente antes de utilizarlas.');
  return Object.freeze({mode:'diagnostico_qa_solo_lectura',steps});
}
