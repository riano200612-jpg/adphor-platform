import {PROPERTY_ROLES} from './services/access-governance.js';
import {classifyLegacyCandidate,prepareLegacyInviteDraft} from './services/legacy-onboarding.js';

// Se monta únicamente después de verificación real por backend; nunca confía en role='admin' del inmueble.
const node=(tag,text='',cls='')=>{
 const n=document.createElement(tag);n.textContent=text;if(cls)n.className=cls;return n;
};
function field(title,control){const wrap=node('label','','access-field');wrap.append(node('span',title),control);return wrap;}
function control(tag,type='',placeholder=''){const n=node(tag);if(type)n.type=type;if(placeholder)n.placeholder=placeholder;return n;}
function fillProjects(select,projects){select.append(new Option('Selecciona una copropiedad',''));
 for(const p of projects){if(p?.id)select.append(new Option(String(p.name||p.id),p.id));}}
function fillRoles(select){for(const [id,label] of Object.entries(PROPERTY_ROLES))select.append(new Option(label,id));}
function button(text){const n=node('button',text,'btn secondary');n.type='submit';return n;}
function form(title){const f=node('form','','access-workflow panel adphor-simple-form');f.noValidate=true;f.append(node('h3',title));return f;}
function roleAssignments(formHost,projects,grants){
 const selected=new Map((Array.isArray(grants)?grants:[]).map(g=>[g.project_id,g.role]));
 const wrap=node('div','','access-grants-editor');
 const result=[];
 for(const p of projects){
  if(!p?.id)continue;
  const line=node('div','','access-grant-row');
  const checkbox=control('input','checkbox');checkbox.checked=selected.has(p.id);
  checkbox.setAttribute('aria-label','Permitir '+String(p.name||p.id));
  const role=control('select');fillRoles(role);role.value=selected.get(p.id)||'viewer';
  const label=node('label');label.append(checkbox,node('span',String(p.name||p.id)));
  line.append(label,role);wrap.append(line);result.push({checkbox,role,project_id:p.id});
 }
 formHost.replaceChildren(wrap);
 const getSelected=()=>result.filter(x=>x.checkbox.checked)
   .map(x=>({project_id:x.project_id,role:x.role.value}));
 // A historical user must never inherit a prior invitee's assignments.
 getSelected.reset=()=>{for(const x of result){x.checkbox.checked=false;x.role.value='viewer';}};
 return getSelected;
}
const statusText={
 active:'Habilitado (sujeto a MFA)',inviting:'Invitación en curso',
 suspended:'Suspendido',offboarded:'Desvinculado'
};
export async function mountLiveIamAdmin(root,{iam,projects=[]}={}){
 if(!iam||typeof iam.read!=='function')return;
 const section=node('section','','access-live');
 const status=node('p','Comprobando autorización administrativa general…','muted');
 status.setAttribute('role','status');section.append(status);root.append(section);
 let data;
 try{data=await iam.read();}catch{
  status.textContent='Operaciones reales aún no habilitadas en QA o sesión sin autorización general.';
  return;
 }
 if(!section.isConnected)return;
 if(data?.enabled!==true||!Array.isArray(data.accounts)||!Array.isArray(data.audit)){
  status.textContent='Servicio de gestión no certificado.';return;
 }
 const refresh=async()=>{const next=await iam.read();if(next.enabled!==true)throw Error('Acceso revocado.');data=next;draw();};
 const run=async(action,body,submit)=>{
  if(!window.confirm('Esta acción modificará realmente permisos o cuentas en QA. ¿Confirmas que está autorizada?'))return;
  submit.disabled=true;status.textContent='Enviando operación autorizada…';
  try {
   const out=await iam.command({action,...body});
   if(!['invited','permissions_updated','offboard_complete'].includes(out?.status)){
     status.textContent='Operación pendiente de conciliación. Revisa el historial antes de reintentar.';
     return;
   }
   await refresh();
   status.textContent='Acción confirmada por el servicio de QA. Verifica el resultado en el historial.';
  }catch{
   status.textContent='No se confirmó el resultado. Revisa la auditoría antes de reintentar.';
  }finally{submit.disabled=false;}
 };
 const draw=()=>{
  section.replaceChildren();
  section.append(node('h2','Operaciones administrativas reales · QA'));
  const note=node('p','Sesión y privilegio técnico verificados por servidor. Estas acciones cambian datos de QA y dejan registro.','access-security-note');
  section.append(note);
  section.append(status);
  status.textContent='Backend autorizado · control por cuenta, MFA y copropiedad';
  const metrics=node('div','','access-metrics');
  const readiness=data.admin_state;
  if(readiness){
   for(const [label,value] of [['Administradores registrados',readiness.configured],['Administradores activos',readiness.active],['Correos admin confirmados',readiness.confirmed],['Admins con MFA',readiness.mfa_verified]]){
    const metric=node('div');metric.append(node('span',label),node('strong',String(value??'—')));metrics.append(metric);
   }
  }
  for(const [label,value] of [['Cuentas laborales gestionadas',data.accounts.length],
    ['Habilitadas',data.accounts.filter(a=>a.status==='active').length],
    ['Suspendidas',data.accounts.filter(a=>a.status==='suspended').length],
    ['Desvinculadas',data.accounts.filter(a=>a.status==='offboarded').length]]){
   const card=node('div');card.append(node('span',label),node('strong',String(value)));metrics.append(card);
  }section.append(metrics);
  const forms=node('div','','access-forms');
  const invite=form('Invitar personal (correo y contraseña propia)');
  let selectedHistoricAlias='';
  const inviteName=control('input','text','Nombre completo');inviteName.maxLength=120;
  // Editing the selected name invalidates the alias association, never silently reuses it.
  inviteName.addEventListener('input',()=>{
   if(selectedHistoricAlias){selectedHistoricAlias='';
    status.textContent='Nombre modificado. La vinculación al alias histórico se canceló; vuelve a preseleccionarlo para asociarlo.';}
  });
  const inviteEmail=control('input','email','persona@empresa.com');
  const inviteGrantsHost=node('div');
  const selectedInviteGrants=roleAssignments(inviteGrantsHost,projects,[]);
  const inviteProperties=node('fieldset','','access-invite-properties');
  inviteProperties.append(node('legend','Copropiedades y roles autorizados'),inviteGrantsHost);
  inviteProperties.append(node('p',
   'Marca únicamente las copropiedades verificadas. Cada una puede tener un rol diferente.','access-security-note'));
  const inviteReason=control('textarea','','Motivo y aprobación administrativa');inviteReason.maxLength=500;inviteReason.rows=2;
  const inviteButton=button('Enviar invitación real');
  invite.append(field('Nombre',inviteName),field('Correo personal verificado',inviteEmail),
    inviteProperties,field('Motivo de autorización',inviteReason),inviteButton);
  invite.addEventListener('submit',e=>{
   e.preventDefault();
   const assignments=selectedInviteGrants();
   if(!inviteName.value.trim()||!inviteEmail.validity.valid||!inviteEmail.value.trim()||
      assignments.length===0||assignments.length>100||inviteReason.value.trim().length<8){
    status.textContent='Completa nombre, correo válido, al menos una copropiedad y motivo de autorización.';return;
   }
   void run('invite',{name:inviteName.value.trim(),email:inviteEmail.value.trim(),
    assignments,reason:inviteReason.value.trim(),
    ...(selectedHistoricAlias?{historic_alias:selectedHistoricAlias}:{})},inviteButton);
  });
  const grants=form('Cambiar permisos por copropiedad');
  const choose=control('select');choose.append(new Option('Selecciona cuenta habilitada',''));
  for(const a of data.accounts.filter(a=>a.status==='active')){
   choose.append(new Option(a.name+' · '+a.email,a.email));
  }
  const grantHost=node('div');let selectedGrants=()=>[];
  const renderGrants=()=>{
   const account=data.accounts.find(a=>a.email===choose.value);
   selectedGrants=roleAssignments(grantHost,projects,account?.assignments||[]);
  };
  choose.addEventListener('change',renderGrants);renderGrants();
  const grantReason=control('textarea','','Motivo del cambio de permisos');grantReason.maxLength=500;grantReason.rows=2;
  const grantButton=button('Actualizar permisos reales');
  grants.append(field('Cuenta laboral',choose),grantHost,field('Motivo y aprobación',grantReason),grantButton);
  grants.addEventListener('submit',e=>{
   e.preventDefault();if(!choose.value||grantReason.value.trim().length<8||selectedGrants().length===0){
    status.textContent='Selecciona una cuenta, al menos una copropiedad y el motivo.';return;}
   void run('grant',{email:choose.value,assignments:selectedGrants(),reason:grantReason.value.trim()},grantButton);
  });
  const removal=form('Suspender o desvincular');
  const user=control('select');user.append(new Option('Selecciona una cuenta laboral',''));
  for(const a of data.accounts.filter(a=>a.user_id&&['active','suspended'].includes(a.status))){
   user.append(new Option(a.name+' · '+a.email+' · '+(statusText[a.status]||a.status),a.email));
  }
  const confirmation=control('input','text','Escribe exactamente el correo seleccionado');
  confirmation.autocomplete='off';
  const reason=control('textarea','','Motivo documentado de baja');reason.rows=2;reason.maxLength=500;
  const action=control('select');
  action.append(new Option('Suspender temporalmente','suspend'),new Option('Desvincular definitivamente','offboard'));
  const removeButton=button('Ejecutar baja en QA');
  removal.append(field('Cuenta laboral',user),field('Operación',action),
    field('Confirmación del correo',confirmation),field('Motivo',reason),removeButton);
  removal.addEventListener('submit',e=>{
   e.preventDefault();
   if(!user.value||confirmation.value.trim().toLowerCase()!==user.value||reason.value.trim().length<8){
    status.textContent='Debes escribir el correo exacto y documentar el motivo.';return;}
   void run(action.value,{email:user.value,reason:reason.value.trim()},removeButton);
  });
  forms.append(invite,grants,removal);section.append(forms);
  // Read-only inventory, already authorized by the backend IAM AAL2 gate.
  if(Array.isArray(data.legacy_review?.candidates)){
   const catalog=data.legacy_review.candidates;
   section.append(node('h3','Usuarios históricos · conciliación previa al ingreso'));
   section.append(node('p','Consulta administrativa. No activa usuarios ni reutiliza PIN. Verifica la identidad y un correo personal antes de invitar.','access-security-note'));
   section.append(node('p',
     'Identificadores: '+String(data.legacy_review.total)+
     ' · Coinciden con personal: '+String(catalog.filter(c=>c.staff_matched).length)+
     ' · Sin Auth vinculado: '+String(catalog.filter(c=>!c.auth_linked).length)));
   const lookup=control('input','search','Buscar usuario, nombre o estado');
   lookup.setAttribute('aria-label','Buscar usuarios históricos');
   const wrap=node('div','','access-table-wrap');
   const table=node('table');
   const hdr=node('tr');
   for(const label of ['Usuario','Persona','Estado original','Conciliación','Personal QA','Preparación'])
    hdr.append(node('th',label));
   const th=node('thead');th.append(hdr);table.append(th);
   const tb=node('tbody');table.append(tb);wrap.append(table);
   const drawCandidates=()=>{
    const term=lookup.value.trim().toLocaleLowerCase('es');
    const found=catalog.filter(c=>[c.username,c.display_name,c.legacy_status,
       c.review_classification].some(v=>String(v).toLocaleLowerCase('es').includes(term)));
    tb.replaceChildren();
    for(const candidate of found){
     const tr=node('tr');
     for(const val of [candidate.username,candidate.display_name,
       candidate.legacy_status,candidate.review_classification,
       candidate.staff_matched?'Encontrado':'Pendiente']){
      tr.append(node('td',String(val)));
     }
     const readiness=classifyLegacyCandidate(candidate);
     const actionCell=node('td');
     if(readiness.canPrepare){
      const preselect=node('button','Preseleccionar','btn secondary');
      preselect.type='button';
      preselect.setAttribute('aria-label','Preseleccionar '+candidate.username+' para invitación');
      preselect.addEventListener('click',()=>{
       try{
        const draft=prepareLegacyInviteDraft(candidate);
        // Clearing all prior form data is mandatory: never accidentally send
        // another employee's email, property grants, or approval text.
        inviteName.value=draft.display_name;
        selectedHistoricAlias=draft.historic_alias;
        inviteEmail.value='';
        selectedInviteGrants.reset();
        inviteReason.value='';
        status.textContent='Preseleccionado '+draft.historic_alias+
          '. Se asociará a la invitación solo tras validación de servidor. Verifica identidad, correo personal, copropiedad y motivo; el usuario establecerá su propia contraseña y MFA.';
        invite.scrollIntoView?.({behavior:'smooth',block:'nearest'});
        inviteEmail.focus();
       }catch{status.textContent='No se pudo preparar esta identidad. Revisa su estado.';}
      });
      actionCell.append(preselect);
     }else{
      actionCell.append(node('span',readiness.reason,'muted'));
     }
     tr.append(actionCell);
     tb.append(tr);
    }
    if(!found.length){const tr=node('tr');const td=node('td','Sin coincidencias.');
      td.colSpan=6;tr.append(td);tb.append(tr);}
   };
   lookup.addEventListener('input',drawCandidates);
   section.append(lookup,wrap);drawCandidates();
  }
  const heading=node('h3','Historial administrativo reciente');section.append(heading);
  const table=node('table');const head=node('tr');
  for(const label of ['Fecha','Acción','Cuenta','Resultado'])head.append(node('th',label));
  const thead=node('thead');thead.append(head);table.append(thead);
  const tbody=node('tbody');
  for(const item of data.audit.slice(0,50)){
   const row=node('tr');
   for(const val of [item.occurred_at||'—',item.action||'—',item.target_email||'—',item.result?.status||'—'])
    row.append(node('td',String(val)));
   tbody.append(row);
  }
  if(!data.audit.length){const row=node('tr');const cell=node('td','No hay movimientos registrados.');cell.colSpan=4;row.append(cell);tbody.append(row);}
  table.append(tbody);const tableWrap=node('div','','access-table-wrap');tableWrap.append(table);section.append(tableWrap);
 };
 draw();
}
