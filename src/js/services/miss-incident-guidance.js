// Miss ADPHOR incident intake: provisional guidance only, not diagnosis or execution.
const norm = s => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const risk = {standard:1,high:2,critical:3};
const kinds = Object.freeze([
 {id:'fire',pattern:/\b(incendio|fuego|humo|alarma de incendio)\b/,risk:'critical',specialty:'servicios oficiales de emergencia y personal de seguridad'},
 {id:'gas',pattern:/\b(gas|olor a gas|fuga de gas)\b/,risk:'critical',specialty:'servicios oficiales de emergencia y técnico de gas autorizado'},
 {id:'security',pattern:/\b(ciberataque|hackeo|phishing|cuenta comprometida|acceso no autorizado|intrusion|filtracion de datos)\b/,risk:'high',specialty:'responsable de seguridad digital'},
 {id:'elevator',pattern:/\b(ascensor(?:es)?|elevador(?:es)?)\b/,risk:'high',specialty:'mantenimiento autorizado de ascensores'},
 {id:'electrical',pattern:/\b(electricidad|electrico|electrica|cortocircuito|cable pelado|tablero electrico|sin luz)\b/,risk:'high',specialty:'electricista autorizado'},
 {id:'water',pattern:/\b(fuga de agua|tuberia|plomeria|inundacion|bajante|alcantarillado|humedad)\b/,risk:'standard',specialty:'técnico hidráulico o plomero autorizado'},
 {id:'access',pattern:/\b(cerradura|porton|puerta automatica|control de acceso fisico|barrera vehicular)\b/,risk:'standard',specialty:'técnico autorizado de accesos físicos'},
 {id:'hvac',pattern:/\b(aire acondicionado|ventilacion|extractor|climatizacion)\b/,risk:'standard',specialty:'técnico de climatización'}
]);
export function missIncidentIntent(question){
 if(typeof question!=='string'||question.length>350)return false;
 const q=norm(question);
 return /\b(averia|dano|danado|se dano|rompio|roto|reparar|reparacion|proveedor|tecnico|emergencia|fuga|incendio|humo|fallo|falla|no funciona|no sirve|reportar incidente|reportar novedad)\b/.test(q)
    || (kinds.some(k=>k.pattern.test(q)) && /\b(ayuda|problema|quien|solucion|asistencia|arreglar)\b/.test(q));
}
export function classifyMissIncident(question){
 if(typeof question!=='string'||question.length>350||!question.trim())throw Error('Reporte no verificable.');
 const q=norm(question);
 const hits=kinds.filter(k=>k.pattern.test(q)).sort((a,b)=>risk[b.risk]-risk[a.risk]);
 const emergency=hits.some(k=>['fire','gas'].includes(k.id))||
   /\b(persona atrapada|persona herida|riesgo de muerte)\b/.test(q);
 const only=hits.length===1?hits[0]:null;
 return Object.freeze({
  category:only?.id||'unclassified',
  specialty:only?.specialty||null,
  priority:emergency?'critical':(hits[0]?.risk||'unclassified'),
  ambiguous:hits.length>1,
  emergency,
  origin:'unverified_user_report',
  method:'rules',
  diagnosisVerified:false,
  providerSelected:false,
  alarmSent:false,
  caseCreated:false,
  modelTrained:false,
  humanReviewRequired:true
 });
}
export function describeMissIncident(result,{role='viewer',mode='demo'}={}){
 if(result?.origin!=='unverified_user_report'||result.method!=='rules'||
    result.diagnosisVerified!==false||result.providerSelected!==false||
    result.alarmSent!==false||result.caseCreated!==false||
    result.modelTrained!==false||result.humanReviewRequired!==true)
  throw Error('Evaluación de incidencia no confiable.');
 const danger=result.emergency
  ?'Puede ser una emergencia: utiliza inmediatamente los servicios oficiales de emergencia y avisa a seguridad de la copropiedad. No intentes manipular instalaciones peligrosas. '
  :'Si hay riesgo inmediato para personas, utiliza los servicios oficiales de emergencia. ';
 const specialty=result.specialty
  ?'Especialidad sugerida para revisión: '+result.specialty+'. '
  :'No puedo identificar una especialidad única con esta descripción; Administración debe clasificar el caso. ';
 const catalog=['admin','coordinator'].includes(role)
  ?'La base de proveedores aprobados aún no está conectada: no he identificado un proveedor concreto ni enviado alertas. '
  :'Los proveedores y sus contactos solo podrán consultarse con permisos administrativos y MFA verificados. ';
 return 'Soy Miss ADPHOR. Esta es una orientación preliminar por reglas, no un diagnóstico comprobado. '+
   danger+specialty+catalog+
   'Puedes abrir Recorridos para registrar una novedad y adjuntar evidencias en el sistema autorizado; esta conversación no registra nada. '+
   'La asignación, aviso, contratación y cierre requieren autorización humana. '+
   (mode==='demo'?'Estás en modo demostración; no uses datos reales. ':'')+
   'No he entrenado modelos ni enviado información a terceros.';
}
export function missCapabilitiesIntent(question){
 if(typeof question!=='string'||question.length>350)return false;
 const q=norm(question).replace(/[¿?]/g,'');
 return /^(?:que puede hacer miss (?:adphor|afor)|funciones de miss (?:adphor|afor)|que administra miss (?:adphor|afor)|como funciona el ecosistema de miss (?:adphor|afor))$/.test(q);
}
export function describeMissCapabilities(role='viewer'){
 return 'Soy Miss ADPHOR, la interfaz virtual del ecosistema. Actualmente puedo orientar sobre los módulos y los registros que tu sesión está autorizada a consultar. '+
   (['admin','coordinator'].includes(role)
    ?'Las consultas actuales de PQRS, Visitas, reuniones y panoramas operativos usan reglas, con revisión administrativa. '
    :'Las funciones empresariales internas requieren permisos específicos. ')+
   'La gestión autónoma de usuarios, proveedores, incidentes, seguridad, alertas y reportes aún depende de servicios y controles por certificar. '+
   'El aprendizaje con datos reales no está activado: requiere evaluación, minimización, base legal aplicable y aprobación humana.';
}
