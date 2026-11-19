import {mountLiveIamAdmin} from './ui-iam-live.js';
import {PROPERTY_ROLES,visibleAccessInventory,filterAccessInventory,prepareAccessDraft} from './services/access-governance.js';
import '../css/access-management.css';

// Toda información externa se escribe con textContent, nunca como HTML.
function el(tag,value='',className=''){
  const node=document.createElement(tag);
  if(value!==undefined && value!==null)node.textContent=String(value);
  if(className)node.className=className;
  return node;
}
function labeledControl(label,control){
  const wrap=el('label','','access-field');
  wrap.append(el('span',label),control);
  return wrap;
}
function metric(label,value,foot){
  const div=el('div');
  div.append(el('span',label),el('strong',value),el('small',foot));
  return div;
}
function sectionTitle(title,description){
  const row=el('div','','access-section-heading');
  const inner=el('div');inner.append(el('h2',title),el('p',description));row.append(inner);
  return row;
}
function card(title,description,label,action,disabled=false){
  const node=el('article','','access-action');
  const button=el('button',label,'btn secondary');
  button.type='button';button.disabled=disabled;
  if(disabled)button.title='Pendiente de autorización general y backend seguro';
  else button.addEventListener('click',action);
  node.append(el('h3',title),el('p',description),button);
  return node;
}
function draftOutput(){
  const wrap=el('div','','access-draft-output');
  const status=el('p','','muted');status.setAttribute('role','status');
  const result=el('textarea');result.rows=10;result.readOnly=true;result.hidden=true;
  result.setAttribute('aria-label','Borrador local de solicitud sin ejecutar');
  wrap.append(status,result);
  return {wrap,status,result,show(text){
    status.textContent='Borrador preparado únicamente en este navegador. No se ha enviado ni ejecutado ningún cambio.';
    result.value=text;result.hidden=false;result.focus();result.select();
  },error(message){status.textContent=message;result.hidden=true;result.value='';}};
}
export function mountAccessManagement(root,{members=[],projects=[],iam=null}={}){
  if(!root)return;
  root.replaceChildren();
  const users=visibleAccessInventory(members,projects);
  const panel=el('section','','access-console');
  const hero=el('div','','access-hero');
  const intro=el('div');
  intro.append(
    el('p','CENTRO ADMINISTRATIVO · QA INTEGRAL','eyebrow'),
    el('h1','Usuarios y permisos'),
    el('p','Consulta los accesos visibles y prepara solicitudes de alta o baja. No se modifican cuentas hasta certificar el servicio administrativo.')
  );
  hero.append(intro,el('span','Modo auditoría · Sin cambios','access-mode'));panel.append(hero);
  const metrics=el('div','','access-metrics');
  metrics.append(
    metric('Usuarios con asignaciones visibles',users.length,'No equivale al total de cuentas Auth'),
    metric('Copropiedades visibles',projects.length,'Alcance real de esta sesión'),
    metric('Asignaciones visibles',new Set((members||[]).filter(m=>m?.user_id&&m?.project_id).map(m=>m.user_id+'|'+m.project_id)).size,'Relaciones usuario–copropiedad')
  );panel.append(metrics);

  panel.append(sectionTitle('Administración de accesos','El rol admin por copropiedad no autoriza altas ni bajas generales.'));
  const actions=el('div','','access-actions');
  actions.append(
    card('Invitar colaborador','Preparar una solicitud de alta con el correo, la copropiedad y el rol mínimo.','Preparar alta',()=>document.getElementById('access-invite-email')?.focus()),
    card('Asignar copropiedades','La autorización definitiva se realizará en el servidor con MFA y alcance aprobado.','Pendiente de backend',null,true),
    card('Roles y permisos','Evita confundir administrador local con administrador general.','Pendiente de backend',null,true),
    card('Suspender acceso','Bloqueo de acceso y sesiones: exige ejecución atómica y verificación.','Pendiente de backend',null,true),
    card('Dar de baja','Preparar un plan verificable que preserve el historial.','Preparar baja',()=>document.getElementById('access-offboard-target')?.focus()),
    card('Historial de cambios','La bitácora inmutable necesita datos de servidor antes de activarse.','Pendiente de backend',null,true)
  );panel.append(actions);

  panel.append(sectionTitle('Inventario de accesos visibles','Filtrado local de asignaciones que la sesión ya puede consultar. Estado Auth y MFA no comprobables desde esta vista.'));
  const search=el('input');search.id='access-user-search';search.type='search';search.autocomplete='off';search.placeholder='Buscar por nombre, rol o copropiedad';
  panel.append(labeledControl('Buscar accesos',search));
  const tableWrap=el('div','','access-table-wrap');
  const table=el('table');const thead=el('thead');const heading=el('tr');
  for(const name of ['Usuario','Rol registrado','Copropiedades visibles','Estado Auth/MFA','Plan de baja']){
    const th=el('th',name);th.scope='col';heading.append(th);
  }
  thead.append(heading);const tbody=el('tbody');table.append(thead,tbody);tableWrap.append(table);panel.append(tableWrap);

  panel.append(sectionTitle('Preparar solicitudes','Borradores para revisión interna. Esta interfaz NO envía correos, crea cuentas ni revoca accesos.'));
  const forms=el('div','','access-forms');

  const invitation=el('form','','access-workflow panel adphor-simple-form');invitation.noValidate=true;
  invitation.append(el('h3','Solicitud de alta'),el('p','Un colaborador del directorio no recibe credenciales automáticamente.','muted'));
  const email=el('input');email.id='access-invite-email';email.type='email';email.required=true;email.autocomplete='off';email.placeholder='persona@empresa.com';
  const project=el('select');project.id='access-invite-property';
  project.append(new Option('Selecciona la copropiedad',''));
  for(const p of projects){if(p?.id)project.append(new Option(String(p.name||p.id),p.id));}
  const role=el('select');role.id='access-invite-role';
  for(const [id,name] of Object.entries(PROPERTY_ROLES))role.append(new Option(name,id));
  invitation.append(labeledControl('Correo de la persona',email),labeledControl('Copropiedad aprobada',project),labeledControl('Rol solicitado',role));
  const inviteButton=el('button','Preparar borrador de alta','btn secondary');inviteButton.type='submit';invitation.append(inviteButton);
  const inviteResult=draftOutput();invitation.append(inviteResult.wrap);
  invitation.addEventListener('submit',event=>{
    event.preventDefault();
    try{inviteResult.show(prepareAccessDraft({kind:'invite',email:email.value,projectId:project.value,role:role.value},users,projects));}
    catch(error){inviteResult.error(error.message);}
  });

  const offboarding=el('form','','access-workflow panel adphor-simple-form');offboarding.noValidate=true;
  offboarding.append(el('h3','Solicitud de baja'),el('p','Retirar acceso no significa borrar la persona, los casos o las evidencias.','muted'));
  const target=el('select');target.id='access-offboard-target';
  target.append(new Option('Selecciona un usuario visible',''));
  for(const u of users)target.append(new Option(u.name+' · '+u.projectIds.length+' copropiedad(es)',u.id));
  const reason=el('textarea');reason.id='access-offboard-reason';reason.rows=3;reason.maxLength=500;reason.placeholder='Motivo de la solicitud (sin datos sensibles)';
  offboarding.append(labeledControl('Cuenta a revisar',target),labeledControl('Motivo',reason));
  const offboardButton=el('button','Preparar borrador de baja','btn secondary');offboardButton.type='submit';offboarding.append(offboardButton);
  const offboardResult=draftOutput();offboarding.append(offboardResult.wrap);
  offboarding.addEventListener('submit',event=>{
    event.preventDefault();
    try{offboardResult.show(prepareAccessDraft({kind:'offboard',targetId:target.value,reason:reason.value},users,projects));}
    catch(error){offboardResult.error(error.message);}
  });
  forms.append(invitation,offboarding);panel.append(forms);

  const renderRows=()=>{
    tbody.replaceChildren();
    const rows=filterAccessInventory(users,search.value);
    for(const u of rows){
      const tr=el('tr');
      for(const value of [u.name,u.roles.map(r=>PROPERTY_ROLES[r]||r).join(', '),u.projectNames.join(', '),u.accountStatus])tr.append(el('td',value));
      const td=el('td');const button=el('button','Preparar baja','btn secondary');button.type='button';
      button.addEventListener('click',()=>{target.value=u.id;target.focus();offboarding.scrollIntoView({block:'nearest'});});
      td.append(button);tr.append(td);tbody.append(tr);
    }
    if(!rows.length){const tr=el('tr');const td=el('td','No hay asignaciones visibles con este filtro.');td.colSpan=5;tr.append(td);tbody.append(tr);}
  };
  search.addEventListener('input',renderRows);renderRows();
  panel.append(el('p','Seguridad: los botones habilitados únicamente preparan texto local. El servidor deberá verificar administrador general, MFA AAL2, tenencia y aprobación, proteger al último administrador, revocar sesiones y registrar cada cambio antes de permitir su ejecución.','access-security-note'));
  root.append(panel);
  // El servidor determina si realmente existen privilegios generales y operaciones activas.
  void mountLiveIamAdmin(root,{iam,projects});
}
