// Miss ADPHOR QA — scoped, human-confirmed task starters.
// A task starter opens an existing form. It never submits, approves, sends,
// reserves calendar slots, or bypasses server-side membership and MFA checks.
const actions=Object.freeze([
 Object.freeze({id:'pqrs',label:'Preparar PQRS',page:'pqrs',roles:null,
  message:'Abriré PQRS para preparar una solicitud de esta copropiedad. Revisa los datos y adjuntos antes de enviarla; todavía no se ha radicado nada.'}),
 Object.freeze({id:'visit',label:'Preparar visita',page:'visits',roles:['admin','coordinator'],
  message:'Abriré Visitas para preparar motivo, fecha y responsable. La visita solo se registrará cuando confirmes el formulario y el servidor autorice la operación.'}),
 Object.freeze({id:'incident',label:'Registrar novedad',page:'recorridos',roles:['admin','coordinator','technician'],
  message:'Abriré el formulario de novedad de esta copropiedad. Debes revisar ubicación, responsable y evidencias antes de guardar; todavía no se creó un caso.'}),
 Object.freeze({id:'meeting',label:'Preparar reunión',page:'meetings',roles:null,
  message:'Abriré Reuniones para preparar la solicitud. La disponibilidad debe comprobarse en el módulo; no he reservado ni creado eventos en Google Calendar.'}),
 Object.freeze({id:'weekly',label:'Informe semanal',page:'reports',roles:['admin','coordinator'],
  message:'Abriré Informes para preparar un borrador con los registros autorizados y revisar fuentes. No he enviado ni aprobado ningún informe.'}),
 Object.freeze({id:'document',label:'Adjuntar documento',page:'miss-documents',roles:null,
  message:'Puedes seleccionar PDF, DOCX o XLSX, o registrar un enlace directo de Drive. Todo aporte queda en cuarentena privada y no se entrega a los agentes de IA.'})
]);
const known=new Map(actions.map(x=>[x.id,x]));
const normalize=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
 .toLowerCase().replace(/[¿?]/g,'').replace(/\s+/g,' ').trim();

export function missTaskList(context={}, {documentsEnabled=false}={}) {
 return actions.map(action=>({
  id:action.id,label:action.label,
  enabled:missTaskPlan(context,action.id,{documentsEnabled}).ok
 }));
}
export function missTaskPlan(context={},id,{documentsEnabled=false}={}) {
 const task=known.get(id);
 if(!task)return Object.freeze({ok:false,page:null,message:'Acción no reconocida.'});
 if(context.mode!=='cloud'||typeof context.userId!=='string'||!context.userId||
    !context.projectId||context.project?.id!==context.projectId)
  return Object.freeze({ok:false,page:null,message:'Para iniciar un trámite necesitas una sesión real en QA y una copropiedad seleccionada.'});
 if(!Array.isArray(context.availablePages)||!context.availablePages.includes(task.page))
  return Object.freeze({ok:false,page:null,message:'Esta función no está disponible para tu sesión. Comprueba el módulo y los permisos.'});
 if(task.roles&&!task.roles.includes(context.role))
  return Object.freeze({ok:false,page:null,message:'Tu rol no permite preparar esta operación. Solicita autorización a la administración.'});
 if(id==='document'&&!documentsEnabled)
  return Object.freeze({ok:false,page:null,message:'La recepción documental de Miss ADPHOR permanece desactivada hasta certificar MFA, aislamiento y análisis de archivos.'});
 return Object.freeze({ok:true,page:task.page,id:task.id,message:task.message,externalEffect:false,requiresHumanConfirmation:true});
}
export function missTaskIntent(question){
 if(typeof question!=='string'||question.length>350)return null;
 const q=normalize(question).replace(/^miss adphor[, ]*/,'');
 if(/(?:radicar|preparar|crear|registrar|nueva) (?:una |un |nueva |nuevo )?(?:pqrs|peticion|queja|reclamo|sugerencia)\b/.test(q))return 'pqrs';
 if(/(?:preparar|programar|agendar|registrar|crear) (?:una |un )?visita\b/.test(q))return 'visit';
 if(/(?:registrar|crear|reportar|preparar) (?:una |un )?(?:novedad|incidencia|hallazgo|mantenimiento)\b/.test(q))return 'incident';
 if(/(?:programar|agendar|preparar|solicitar|crear) (?:una |un )?reunion\b/.test(q))return 'meeting';
 if(/(?:preparar|generar|crear|elaborar) (?:un |el )?(?:informe|reporte) (?:gerencial )?semanal\b/.test(q))return 'weekly';
 if(/(?:adjuntar|anexar|subir|cargar|agregar) (?:un |una |mis |los |las )?(?:archivos?|documentos?|pdf|word|excel)\b/.test(q))return 'document';
 return null;
}
