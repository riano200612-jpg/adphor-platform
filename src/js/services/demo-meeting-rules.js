// Client-side demonstration ONLY: never use these rules to authorize a real booking.
export function assessLocalMeeting({subject,notes='',management_requested=false}) {
 const text=String(subject||'').trim();
 if(text.length<3)throw Error('El asunto debe tener al menos tres caracteres.');
 const all=(text+' '+String(notes)).toLocaleLowerCase('es');
 const high=['emergencia','incendio','inundación','seguridad','riesgo estructural','amenaza'].some(w=>all.includes(w));
 const medium=['mantenimiento','reclamo','queja','pqrs','reparación'].some(w=>all.includes(w));
 return {priority_level:high?'alto':medium?'medio':'bajo',requires_management:high||Boolean(management_requested),
  reason:high?'Posible riesgo o emergencia; revisar con Gerencia':medium?'Tema operativo o de atención':'Asunto ordinario; confirmar prioridad con el administrador',
  engine_kind:'local_qa_rules',status:'pending_administrator_review',booking_authorized:false};
}
