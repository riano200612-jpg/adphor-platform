// Client-origin Miss ADPHOR guidance, adapted from portal/JavaScript.html.
// Text-only assistance; never issues requests, changes case state, or trains models.
export const MISS_ADPHOR_GUIDANCE=Object.freeze({
 idle:'¡Hola! Te doy la bienvenida al Portal Digital ADPHOR. ¿En qué te puedo asesorar hoy?',
 wave:'¡Un cordial saludo! Estoy aquí para acompañarte en tus solicitudes y trámites en línea.',
 watch:'Disponibilidad y atención oportuna. Consulta los tiempos de tu comunidad.',
 tablet:'Consulta registros y trámites desde tu copropiedad autorizada.',
 inspect:'Revisa solicitudes, PQRS y mantenimiento con transparencia y trazabilidad.',
 phone:'Contacta al responsable de atención desde los canales autorizados.'
});
export function guidanceForArea(area) {
 const routes={pqrs:'inspect',tickets:'inspect',recorridos:'inspect',meetings:'watch',reports:'tablet',dashboard:'wave'};
 return MISS_ADPHOR_GUIDANCE[routes[area]||'idle'];
}
