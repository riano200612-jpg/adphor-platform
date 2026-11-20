import {buildOperationalAgenda} from './services/operational-agenda.js';
import {isManager} from './core/workflow.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({
 '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[c]));

export function renderOperationalAgenda(tickets,{projectId,userId,role='viewer',scope='mine',asOf,compact=false}={}){
 const snapshot=buildOperationalAgenda(tickets,{projectId,userId,role,scope:compact?'mine':scope,asOf});
 const team=snapshot.scope==='team';
 const keyGroups=snapshot.groups.slice(0,4);
 const highlight=keyGroups.map(g=>
  '<div class="operational-agenda-stat"><span>'+esc(g.label)+'</span><strong>'+g.items.length+'</strong></div>'
 ).join('');
 const columns=keyGroups.map(group=>{
  const visible=group.items.slice(0,compact?2:8);
  return '<div class="operational-agenda-window" data-operational-group="'+esc(group.key)+'">'+
   '<h3>'+esc(group.label)+' <span>'+group.items.length+'</span></h3>'+
   (visible.length?'<ul>'+visible.map(item=>
    '<li><button type="button" data-ticket="'+esc(item.id)+'">'+
    '<strong>'+esc(item.title)+'</strong><small>'+esc(item.due_date)+' · '+
    esc(item.status)+(item.area?' · '+esc(item.area):'')+
    (team&&!item.assignee?' · Sin responsable asignado':'')+'</small></button></li>'
   ).join('')+'</ul>':'<p class="muted">Sin pendientes registrados.</p>')+
   (group.items.length>visible.length?'<small class="muted">'+
    (group.items.length-visible.length)+' adicionales: consulta la bitácora.</small>':'')+
   '</div>';
 }).join('');
 const later=snapshot.groups[4].items.length;
 const scopeButtons=!compact&&isManager(role)?
  '<div class="sprint-scope operational-agenda-scope" aria-label="Alcance de la agenda operativa">'+
  '<button type="button" data-sprint-scope="mine" aria-pressed="'+(!team)+'">Mis asignaciones</button>'+
  '<button type="button" data-sprint-scope="team" aria-pressed="'+team+'">Equipo de la copropiedad</button></div>'+ 
  '<p class="muted operational-agenda-scope-note">Esta selección también se aplica al plan quincenal. Solo consulta tareas de esta copropiedad.</p>':'';
 return '<section class="panel operational-agenda'+(compact?' operational-agenda-compact':'')+
  '" aria-label="'+(team?'Agenda operativa del equipo':'Agenda operativa de mis tareas')+'">'+
  '<div class="section-heading"><div><p class="eyebrow">AGENDA OPERATIVA · BITÁCORA AUTORIZADA</p>'+
  '<h2>Mis compromisos por plazo</h2><p>Tareas de mantenimiento asignadas a ti en esta copropiedad.</p></div>'+
  '<button type="button" class="btn secondary" data-page="mine">Abrir Mis tareas</button></div>'+
  '<div class="operational-agenda-stats" aria-label="Resumen de vencimientos">'+highlight+'</div>'+
  '<div class="operational-agenda-windows">'+(snapshot.total?columns:
    '<p class="muted">Sin pendientes registrados en la bitácora de esta copropiedad.</p>')+'</div>'+
  '<p class="muted operational-agenda-foot">'+later+' tareas posteriores a 15 días. '+
  (snapshot.unclassified?snapshot.unclassified+' registros no verificables se omitieron. ':'')+
  'Fuente: bitácora persistente; no incluye aún actividades recurrentes, '+
  'tareas administrativas ni reservas de Google Calendar. '+
  'Los cambios de estado se realizan exclusivamente en el flujo autorizado.</p></section>';
}
