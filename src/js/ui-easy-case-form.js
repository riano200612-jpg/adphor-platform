import {availableProjectAreas,availableAssignees} from './services/easy-form-options.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({
 '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[c]));
const option=(id,label,selected='')=>'<option value="'+esc(id)+'"'+
 (id===selected?' selected':'')+'>'+esc(label)+'</option>';
function row(name,label,control,help='',wide=false){
 return '<label'+(wide?' class="span-2"':'')+'>'+label+
  control+(help?'<small>'+esc(help)+'</small>':'')+'</label>';
}
const step=(number,name,detail)=>'<div class="simple-form-step"><span>'+
 number+'</span><strong>'+name+'</strong><small>'+detail+'</small></div>';
const required='<span class="simple-form-required" aria-hidden="true">*</span>';

export function renderEasyCaseForm({project,members,user,role,date,priorities,requestId,photoMarkup}){
 const areas=availableProjectAreas(project);
 const assignees=availableAssignees(members,project?.id);
 const self=assignees.find(m=>m.id===user?.id);
 const technician=role==='technician';
 const current=technician?user?.id:(self?.id||'');
 const assigneeOptions=technician
   ?option(user?.id,user?.name||'Mi usuario',user?.id)
   :'<option value="">Elige un responsable</option>'+
     assignees.map(m=>option(m.id,m.id===user?.id?'Yo · '+m.name:m.name,current)).join('');
 const usable=areas.length>0&&assignees.length>0;
 const areaOptions='<option value="">Elige un área</option>'+
    areas.map(a=>option(a,a)).join('');
 const labels=Array.isArray(priorities)?priorities:[];
 return '<form id="new-case" class="adphor-simple-form" novalidate data-request-id="'+esc(requestId)+'">'+
  '<div class="dialog-body form-grid">'+
  '<p class="simple-form-help">Los campos marcados con <strong>*</strong> son necesarios. Las fotos son opcionales.</p>'+
  step('1','¿Qué sucedió?','Describe la novedad con tus palabras.')+
  row('title','¿Qué pasó? '+required,
    '<input id="case-title" name="title" maxlength="120" placeholder="Ej. Lámpara dañada en el pasillo" required>','',true)+
  row('area','¿En qué área? '+required,
    '<select id="case-area" name="area" required>'+areaOptions+'</select>',
    'Elige la más cercana. Si no aparece, selecciona «Otra área».')+
  row('location','¿Dónde exactamente? '+required,
    '<input id="case-location" name="location" maxlength="180" placeholder="Ej. Primer piso, pasillo" required>',
    'Indica un lugar que el equipo pueda encontrar.')+
  row('description','Cuéntanos un poco más '+required,
    '<textarea id="case-description" name="description" maxlength="2000" rows="3" required placeholder="¿Qué ocurrió y qué ayuda se necesita?"></textarea>','',true)+
  step('2','¿Quién lo atiende y para cuándo?','La prioridad normal está seleccionada.')+
  row('assignee','Responsable '+required,
    '<select id="case-assignee" name="assignee" required'+(technician?' disabled':'')+'>'+assigneeOptions+'</select>',
    technician?'Esta tarea quedará a tu cargo.':self?'Se seleccionó tu usuario. Puedes cambiarlo.':'Elige una persona del equipo autorizado.')+
  row('due_date','Fecha límite '+required,
    '<input id="case-due" name="due_date" type="date" min="'+esc(date)+'" value="'+esc(date)+'" required>',
    'Por defecto es hoy. Puedes escoger otro día.')+
  row('priority','¿Qué tan urgente es?',
    '<select id="case-priority" name="priority">'+labels.map(p=>option(p,p,'Media')).join('')+'</select>',
    '«Media» es el valor inicial.',true)+
  '<details class="simple-form-extra"><summary>Añadir fotos (opcional)</summary><div>'+String(photoMarkup||'')+'</div></details>'+
  (!areas.length?'<p class="notice danger span-2" role="alert">No hay áreas disponibles para esta copropiedad. Solicita configurar el catálogo antes de guardar.</p>':'')+
  (!assignees.length?'<p class="notice danger span-2" role="alert">No hay responsables operativos habilitados para esta copropiedad.</p>':'')+
  '<p class="notice span-2">En una emergencia, llama primero al responsable según el protocolo de tu copropiedad.</p>'+
  '<p class="error simple-form-error span-2" role="alert" aria-live="assertive" tabindex="-1"></p></div>'+
  '<footer class="dialog-footer"><button type="button" class="btn secondary" data-action="close-dialog">Cancelar</button>'+
  '<button class="btn primary"'+(usable?'':' disabled')+'>Guardar novedad</button></footer></form>';
}
