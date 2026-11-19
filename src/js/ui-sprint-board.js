import {buildSprintPlan,canSeeTeamSprint} from './services/sprint-plan.js';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({
 '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[c]));
const fmt=date=>new Intl.DateTimeFormat('es-CO',{timeZone:'UTC',year:'numeric',month:'short',day:'numeric'})
 .format(new Date(date+'T12:00:00.000Z'));

export function renderSprintBoard(tickets,{projectId,userId,role,scope='mine',offset=0,asOf}={}){
 const plan=buildSprintPlan(tickets,{projectId,userId,role,scope,offset,asOf});
 const summary=[
  ['Pendientes',plan.summary.pending],['En proceso',plan.summary.inProgress],
  ['Por verificar',plan.summary.toVerify],['Cerradas (plazo)',plan.summary.closed]
 ].map(([name,count])=>'<div class="sprint-stat"><span>'+esc(name)+'</span><strong>'+count+'</strong></div>').join('');
 const renderItems=items=>{
  if(!items.length)return '<p class="muted">Sin registros para este grupo.</p>';
  return '<ul class="sprint-items">'+items.slice(0,20).map(item=>
   '<li><button type="button" data-ticket="'+esc(item.id)+'"><span><strong>'+
   esc(item.title)+'</strong><small>'+esc(item.area)+' · '+esc(item.status)+'</small></span>'+
   '<span class="sprint-due">'+esc(item.due_date)+'</span></button></li>'
  ).join('')+'</ul>'+(items.length>20?'<p class="muted">'+(items.length-20)+
   ' adicionales: consultar Bitácora.</p>':'');
 };
 const teamAllowed=canSeeTeamSprint(role);
 return '<section class="panel sprint-board" aria-label="Plan quincenal de trabajo">'+
  '<div class="section-heading"><div><p class="eyebrow">PLANIFICACIÓN · 14 DÍAS</p>'+
  '<h2>Plan quincenal</h2><p>Compromisos existentes de mantenimiento; no se generan tareas automáticamente.</p></div></div>'+
  '<div class="sprint-controls" aria-label="Navegación de períodos">'+
  '<button type="button" class="btn secondary" data-sprint-shift="-1" '+
   (offset<=-26?'disabled':'')+'>Período anterior</button>'+
  '<strong data-sprint-period>'+fmt(plan.window.start)+' – '+fmt(plan.window.end)+'</strong>'+
  '<button type="button" class="btn secondary" data-sprint-shift="1" '+
   (offset>=26?'disabled':'')+'>Período siguiente</button></div>'+
  (teamAllowed?'<div class="sprint-scope"><button type="button" data-sprint-scope="mine" aria-pressed="'+(scope==='mine')+'">Mis asignaciones</button>'+
   '<button type="button" data-sprint-scope="team" aria-pressed="'+(scope==='team')+'">Equipo de la copropiedad</button></div>':
   '<p class="muted">Vista de tus propias asignaciones.</p>')+
  '<div class="sprint-stats" aria-label="Estado actual de los casos con plazo en el período">'+summary+'</div>'+
  '<div class="sprint-columns"><div class="sprint-group" data-sprint-group="period"><h3>Plazos del período <span>'+
  plan.inside.length+'</span></h3>'+renderItems(plan.inside)+'</div>'+
  '<div class="sprint-group" data-sprint-group="carryover"><h3>Pendientes anteriores <span>'+
  plan.carryover.length+'</span></h3>'+renderItems(plan.carryover)+'</div></div>'+
  '<p class="muted sprint-footer">'+plan.later.length+' tareas abiertas con plazo posterior al período. '+
   (plan.invalid?plan.invalid+' registros no verificables se omitieron. ':'')+
  'La clasificación refleja el estado ACTUAL y la fecha de plazo, no acredita que una tarea se completó dentro del sprint. '+
  'Cadencia quincenal provisional desde el 1 de diciembre de 2026; José debe aprobar el catálogo y las periodicidades. '+
  'No incluye obligaciones recurrentes sin aprobar, PQRS, Visitas ni reuniones Google Calendar.</p></section>';
}
