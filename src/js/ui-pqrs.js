// Uses the current ADPHOR shell/styles; all untrusted strings rendered as text.
export function mountPqrs(root,{repository,projectId,members=[],role,projectName=projectId}) {
  root.innerHTML='<section class="panel pqrs-page"><div class="pqrs-header"><div><p class="pqrs-kicker">CENTRO DE ATENCIÓN · ADPHOR</p><h2>Peticiones, quejas, reclamos y sugerencias</h2><p class="pqrs-subtitle">Radica y consulta solicitudes de tu copropiedad en un solo lugar.</p></div><button type="button" class="pqrs-new" data-new>+ Nueva PQRS</button></div><p role="status" class="pqrs-message" aria-live="polite"></p><div class="pqrs-toolbar"><label>Filtrar por estado <select data-filter><option value="">Todos</option><option>open</option><option>assigned</option><option>in_progress</option><option>resolved</option><option>closed</option></select></label><button type="button" class="pqrs-refresh" data-refresh>Actualizar lista</button></div><form class="pqrs-form" id="pqrs-create-form"><div class="pqrs-form-title"><h3>Radicar nueva solicitud</h3><p>Completa los datos necesarios para identificar y gestionar el caso.</p></div><div class="pqrs-fields"><label>Tipo<select name="kind"><option value="peticion">Petición</option><option value="queja">Queja</option><option value="reclamo">Reclamo</option><option value="sugerencia">Sugerencia</option></select></label><label>Asunto<input name="subject" required minlength="3" maxlength="200"></label><label>Torre<input name="tower" maxlength="40" placeholder="Ej. Torre 1"></label><label>Apartamento<input name="apartment" maxlength="40" placeholder="Ej. 402"></label><label>Propietario o solicitante<input name="owner" maxlength="120" placeholder="Nombre autorizado"></label><label class="pqrs-wide">Descripción del caso<textarea name="description" required minlength="3" maxlength="6000" rows="4" placeholder="Describe qué sucedió y qué solución necesitas"></textarea></label></div><div class="pqrs-evidence"><label for="pqrs-evidence-files" class="pqrs-evidence-label">📎 Adjuntar evidencia: fotos, videos o documentos</label><input id="pqrs-evidence-files" name="evidence" type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,application/pdf" multiple><p class="pqrs-upload-note">Selecciona hasta 5 archivos de máximo 20 MB cada uno. La carga privada estará disponible cuando se habilite el servicio de adjuntos QA.</p><ul class="pqrs-evidence-list" aria-live="polite"></ul></div><div class="pqrs-actions"><button type="submit" class="pqrs-submit">Enviar solicitud PQRS</button></div></form><div class="pqrs-list-head"><h3>Solicitudes registradas</h3><p>Consulta su estado y seguimiento.</p></div><div data-cases class="pqrs-cases"></div></section>';
  const message=root.querySelector('[role=status]'),list=root.querySelector('[data-cases]'),filter=root.querySelector('[data-filter]');
  const form=root.querySelector('form');
  const evidenceInput=root.querySelector('#pqrs-evidence-files');
  const evidenceList=root.querySelector('.pqrs-evidence-list');
  function selectedEvidence(){
    const files=Array.from(evidenceInput.files||[]);
    if(files.length>5)throw Error('Selecciona máximo cinco archivos.');
    const allowed=new Set(['image/jpeg','image/png','image/webp','video/mp4','video/webm','application/pdf']);
    for(const file of files)if(!allowed.has(file.type)||file.size>20*1024*1024||!file.size)throw Error('Archivo no permitido o superior a 20 MB.');
    return files;
  }
  evidenceInput.onchange=()=>{
    evidenceList.replaceChildren();
    try{
      const files=selectedEvidence();
      for(const file of files){const li=document.createElement('li');li.textContent=file.name+' · '+(file.size/1048576).toFixed(1)+' MB';evidenceList.append(li);}
      message.textContent=files.length?'Evidencias seleccionadas. La subida privada todavía no está habilitada en este entorno.':'';
    }catch(error){message.textContent=error.message;evidenceInput.value='';}
  };

  const context=document.createElement('p');context.className='pqrs-context';context.textContent='Copropiedad: '+projectName;form.querySelector('.pqrs-form-title').after(context);
  if(!repository.localDemo){for(const name of ['tower','apartment','owner']){form.elements[name].disabled=true;form.elements[name].placeholder='Pendiente de migración QA';}const note=document.createElement('p');note.className='notice';note.textContent='Torre, unidad y solicitante requieren una migración QA adicional. Estos campos no se enviarán ni se presentarán como guardados.';context.after(note);}
  const layout=document.createElement('div');layout.className='pqrs-layout';form.before(layout);layout.append(form);const feed=document.createElement('section');feed.append(root.querySelector('.pqrs-list-head'),list);layout.append(feed);
  let requestId=crypto.randomUUID();
  const run=async f=>{try{message.textContent='Procesando…';const result=await f();if(!root.isConnected)return;message.textContent=typeof result==='string'?result:(repository.localDemo?'Cambio guardado en este navegador (demo). No se modificó PostgreSQL.':'Operación confirmada por PostgreSQL.');}catch(e){message.textContent=e.message;}};
  const statusLabels={open:'Abierta',assigned:'Asignada',in_progress:'En atención',resolved:'Resuelta',closed:'Cerrada'};
  for(const o of filter.options)if(statusLabels[o.value])o.textContent=statusLabels[o.value];
  const el=(tag,text)=>{const n=document.createElement(tag);n.textContent=text;return n;};
  async function load(){
    const rows=await repository.list(projectId,filter.value);if(!root.isConnected)return;list.replaceChildren();
    for(const row of rows){
      const card=el('article','');card.className='panel';card.append(el('h3',row.subject),el('p',[row.tower&&'Torre '+row.tower,row.apartment&&'Apto '+row.apartment,row.owner&&'Solicitante '+row.owner].filter(Boolean).join(' · ')),el('p',row.description),el('p',`${statusLabels[row.status]||row.status} · ${row.priority} · versión ${row.version}`),el('p',`Radicado: ${row.id}`));
      const history=el('button','Ver historial');history.onclick=()=>run(async()=>{const events=await repository.history(projectId,row.id);let box=card.querySelector('pre');if(!box){box=el('pre','');card.append(box);}box.textContent=events.map(e=>`${e.occurred_at}: ${e.old_status||'creado'} → ${e.new_status}`).join('\n');});card.append(history);
      if(row.status!=='closed'){
        const response=el('textarea','');response.setAttribute('aria-label','Respuesta');const send=el('button','Guardar respuesta');send.onclick=()=>run(async()=>{await repository.respond(projectId,row.id,response.value);response.value='';});card.append(response,send);
        const status=el('select','');status.setAttribute('aria-label','Nuevo estado');for(const value of ['open','assigned','in_progress','resolved',...(role==='admin'?['closed']:[])]){const o=el('option',statusLabels[value]||value);o.value=value;o.selected=value===row.status;status.append(o);}
        const assignee=el('select','');assignee.setAttribute('aria-label','Responsable');assignee.append(el('option',''));for(const m of members){const o=el('option',m.name||m.user_id);o.value=m.user_id;o.selected=m.user_id===row.assignee;assignee.append(o);}assignee.disabled=!['admin','coordinator'].includes(role);
        const solution=el('textarea',row.solution||'');solution.setAttribute('aria-label','Solución');const save=el('button','Guardar seguimiento');save.onclick=()=>run(async()=>{const patch={status:status.value,solution:solution.value};if(!assignee.disabled)patch.assignee=assignee.value||null;await repository.update(projectId,row.id,row.version,patch);await load();});card.append(status,assignee,solution,save);
        const details=el('details',''),summary=el('summary','Responder y gestionar caso'),body=el('div','');details.append(summary,body);for(const control of [response,send,status,assignee,solution,save])body.append(control);card.append(details);
      }
      list.append(card);
    }
    if(rows.length===200)list.append(el('p','Se muestran los 200 casos más recientes. Aplica un filtro.'));
    if(!rows.length)list.append(el('p','Aún no hay solicitudes visibles. Radica una nueva PQRS o cambia el filtro.'));
    return `${rows.length} solicitudes consultadas · ${repository.localDemo?'Demostración local, no PostgreSQL':'Lectura del servicio PostgreSQL'}`;
  }
  root.querySelector('form').onsubmit=e=>{e.preventDefault();const form=e.currentTarget,button=form.querySelector('button');button.disabled=true;run(async()=>{const files=selectedEvidence();if(files.length)throw Error('No se puede radicar con adjuntos: el almacenamiento privado de evidencias PQRS no está habilitado todavía. Retira los archivos para continuar sin evidencia.');const payload=Object.fromEntries(new FormData(form));delete payload.evidence;const saved=await repository.create(projectId,payload,requestId);if(!saved?.id)throw Error('El servicio no confirmó el radicado. Conserva los datos y vuelve a intentar.');requestId=crypto.randomUUID();form.reset();await load();return `Radicado: ${saved.id} · ${statusLabels[saved.status]||saved.status}. ${repository.localDemo?'Guardado solo en este navegador. No se modificó PostgreSQL.':'Registro confirmado por PostgreSQL.'}`;}).finally(()=>button.disabled=false);};
  root.querySelector('[data-new]').onclick=()=>{root.querySelector('form').scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});root.querySelector('form [name=kind]').focus();};
  root.querySelector('[data-refresh]').onclick=()=>run(load);filter.onchange=()=>run(load);run(load);
}
