import {uploadPrivateEvidence} from './services/private-evidence.js';
import { validateQaEvidence } from './services/qa-evidence-policy.js';
export function pqrsDraftGuidance(form) {
  if(form.elements.subject.value.trim().length<3) return 'Escribe un asunto de al menos tres caracteres.';
  if(form.elements.description.value.trim().length<3) return 'Describe qué sucedió y qué solución necesitas.';
  return 'Revisa la copropiedad, el tipo de solicitud y los adjuntos antes de enviar. Espera un radicado confirmado para comprobar el registro.';
}

// Uses the current ADPHOR shell/styles; all untrusted strings rendered as text.
export function mountPqrs(root,{repository,projectId,members=[],role,projectName=projectId}) {
  root.innerHTML='<section class="panel pqrs-page"><div class="pqrs-header"><div><p class="pqrs-kicker">CENTRO DE ATENCIÓN · ADPHOR</p><h2>Peticiones, quejas, reclamos y sugerencias</h2><p class="pqrs-subtitle">Radica y consulta solicitudes de tu copropiedad en un solo lugar.</p></div><button type="button" class="pqrs-new" data-new>+ Nueva PQRS</button></div><p role="status" class="pqrs-message" aria-live="polite"></p><div class="pqrs-toolbar"><label>Filtrar por estado <select data-filter><option value="">Todos</option><option>open</option><option>assigned</option><option>in_progress</option><option>resolved</option><option>closed</option></select></label><button type="button" class="pqrs-refresh" data-refresh>Actualizar lista</button></div><form class="pqrs-form" id="pqrs-create-form"><div class="pqrs-form-title"><h3>Radicar nueva solicitud</h3><p>Completa los datos necesarios para identificar y gestionar el caso.</p></div><div class="pqrs-fields"><label>Tipo<select name="kind"><option value="peticion">Petición</option><option value="queja">Queja</option><option value="reclamo">Reclamo</option><option value="sugerencia">Sugerencia</option></select></label><label>Asunto<input name="subject" required minlength="3" maxlength="200"></label><label>Torre<input name="tower" maxlength="40" placeholder="Ej. Torre 1"></label><label>Apartamento<input name="apartment" maxlength="40" placeholder="Ej. 402"></label><label>Propietario o solicitante<input name="owner" maxlength="120" placeholder="Nombre autorizado"></label><label class="pqrs-wide">Descripción del caso<textarea name="description" required minlength="3" maxlength="6000" rows="4" placeholder="Describe qué sucedió y qué solución necesitas"></textarea></label></div><div class="pqrs-evidence"><label for="pqrs-evidence-files" class="pqrs-evidence-label">📎 Adjuntar evidencia: fotos, videos o documentos</label><input id="pqrs-evidence-files" name="evidence" type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,application/pdf" multiple><p class="pqrs-upload-note">Selecciona hasta 5 archivos de máximo 20 MB cada uno. La carga privada estará disponible cuando se habilite el servicio de adjuntos QA.</p><ul class="pqrs-evidence-list" aria-live="polite"></ul><div class="pqrs-evidence-preview" role="group" aria-label="Vista previa local de evidencias"></div><button type="button" class="btn secondary pqrs-evidence-clear" data-clear-evidence hidden>Quitar adjuntos seleccionados</button></div><div class="pqrs-actions"><button type="submit" class="pqrs-submit">Enviar solicitud PQRS</button></div></form><div class="pqrs-list-head"><h3>Solicitudes registradas</h3><p>Consulta su estado y seguimiento.</p></div><div data-cases class="pqrs-cases"></div></section>';
  const message=root.querySelector('[role=status]'),list=root.querySelector('[data-cases]'),filter=root.querySelector('[data-filter]');
  const form=root.querySelector('form');
  const guide=document.createElement('details');
  guide.innerHTML='<summary>Miss ADPHOR · Guía de PQRS</summary><p>Filtra por estado para localizar pendientes. Abre «Ver historial» para revisar el radicado. Cuando tu rol lo permita, revisa la respuesta y los cambios antes de guardarlos.</p><p aria-live="polite"></p>';
  const draftGuide=guide.lastElementChild;
  const updateGuide=()=>{if(guide.open)draftGuide.textContent=pqrsDraftGuidance(form);};
  form.querySelector('.pqrs-form-title').after(guide);
  guide.addEventListener('toggle',updateGuide);
  form.addEventListener('input',updateGuide);
  form.addEventListener('reset',()=>queueMicrotask(updateGuide));
  const evidenceInput=root.querySelector('#pqrs-evidence-files');
  const evidenceList=root.querySelector('.pqrs-evidence-list');
  const clearEvidence=root.querySelector('[data-clear-evidence]');
  const evidencePreview=root.querySelector('.pqrs-evidence-preview');
  let previewUrls=[];
  if(typeof repository.uploadEvidence==='function')root.querySelector('.pqrs-upload-note').textContent='Hasta 5 archivos de máximo 20 MB cada uno. Se requiere confirmación del almacenamiento y de la asociación al radicado.';
  function clearPreviews(){for(const url of previewUrls)URL.revokeObjectURL(url);previewUrls=[];evidencePreview.replaceChildren();}
  function addPreview(file){
    if(!file.type.startsWith('image/')&&!file.type.startsWith('video/'))return;
    const url=URL.createObjectURL(file);previewUrls.push(url);
    const media=document.createElement(file.type.startsWith('image/')?'img':'video');
    media.src=url;media.setAttribute('aria-label',file.name);media.className='pqrs-local-preview';
    if(media.tagName==='VIDEO'){media.controls=true;media.preload='metadata';}
    evidencePreview.append(media);
  }
  clearEvidence.onclick=()=>{clearPreviews();evidenceInput.value='';evidenceList.replaceChildren();clearEvidence.hidden=true;message.textContent='Adjuntos retirados. Puedes radicar sin evidencia.';};
  function selectedEvidence(){
    return validateQaEvidence(evidenceInput.files);
  }
  evidenceInput.onchange=()=>{
    evidenceList.replaceChildren();clearPreviews();
    try{
      const files=selectedEvidence();
      for(const file of files){const li=document.createElement('li');li.textContent=file.name+' · '+(file.size/1048576).toFixed(1)+' MB';evidenceList.append(li);addPreview(file);}
      clearEvidence.hidden=!files.length;
      message.textContent=files.length?(typeof repository.uploadEvidence==='function'?'Evidencias seleccionadas. Se confirmará su asociación antes de finalizar el envío.':'Evidencias seleccionadas. La subida privada todavía no está habilitada en este entorno.'):'';
    }catch(error){clearPreviews();message.textContent=error.message;evidenceInput.value='';clearEvidence.hidden=true;}
  };

  const context=document.createElement('p');context.className='pqrs-context';context.textContent='Copropiedad: '+projectName;form.querySelector('.pqrs-form-title').after(context);
  const layout=document.createElement('div');layout.className='pqrs-layout';form.before(layout);layout.append(form);const feed=document.createElement('section');feed.append(root.querySelector('.pqrs-list-head'),list);layout.append(feed);
  let requestId=crypto.randomUUID();
  const run=async f=>{try{message.textContent='Procesando…';const result=await f();if(!root.isConnected)return;message.textContent=typeof result==='string'?result:(repository.localDemo?'Cambio guardado en este navegador (demo). No se modificó PostgreSQL.':'Operación confirmada por PostgreSQL.');}catch(e){message.textContent=e.message;}};
  const statusLabels={open:'Abierta',assigned:'Asignada',in_progress:'En atención',resolved:'Resuelta',closed:'Cerrada'};
  for(const o of filter.options)if(statusLabels[o.value])o.textContent=statusLabels[o.value];
  const el=(tag,text)=>{const n=document.createElement(tag);n.textContent=text;return n;};
  let listRevision=0;
  async function load(){
    const revision=++listRevision;
    const rows=await repository.list(projectId,filter.value);
    if(!list.isConnected || revision!==listRevision)return;
    list.replaceChildren();
    for(const row of rows){
      const card=el('article','');card.className='panel';card.append(el('h3',row.subject),el('p',[row.tower&&'Torre '+row.tower,row.apartment&&'Apto '+row.apartment,row.owner&&'Solicitante '+row.owner].filter(Boolean).join(' · ')),el('p',row.description),el('p',`${statusLabels[row.status]||row.status} · ${row.priority} · versión ${row.version}`),el('p',`Radicado: ${row.id}`));
      const history=el('button','Ver historial');
      history.type='button';
      let loadingTimeline=false;
      const showTimeline=async()=>{
        if(loadingTimeline)return;
        loadingTimeline=true;history.disabled=true;
        try{
          const events=await repository.history(projectId,row.id);
          const responses=typeof repository.responses==='function'
            ?await repository.responses(projectId,row.id):[];
          if(!card.isConnected)return;
          if(!Array.isArray(events)||!Array.isArray(responses)||
             events.some(e=>e.case_id&&e.case_id!==row.id)||
             responses.some(r=>r.case_id!==row.id))
            throw Error('Historial de PQRS no válido.');
          let timeline=card.querySelector('[data-pqrs-timeline]');
          if(!timeline){timeline=document.createElement('section');timeline.dataset.pqrsTimeline='';card.append(timeline);}
          timeline.replaceChildren();
          const lifecycle=el('h4','Cambios de estado');
          const lifecycleList=document.createElement('ol');
          for(const event of events){
            lifecycleList.append(el('li',`${event.occurred_at||'Sin fecha'} · ${event.old_status||'creado'} → ${event.new_status||'sin estado'}`));
          }
          if(!events.length)lifecycleList.append(el('li','No hay cambios de estado visibles.'));
          const answerTitle=el('h4','Respuestas registradas');
          const answerList=document.createElement('ol');
          answerList.dataset.pqrsResponses='';
          for(const answer of responses){
            const item=el('li','');
            const when=el('small',answer.created_at||'Sin fecha');
            const body=el('p',answer.body);
            item.append(when,body);answerList.append(item);
          }
          if(!responses.length)answerList.append(el('li','Todavía no hay respuestas registradas.'));
          timeline.append(lifecycle,lifecycleList,answerTitle,answerList);
        }finally{loadingTimeline=false;if(history.isConnected)history.disabled=false;}
      };
      history.onclick=()=>run(async()=>{await showTimeline();return 'Historial y respuestas consultados.';});
      card.append(history);
      if(row.status!=='closed'){
        const response=el('textarea','');response.setAttribute('aria-label','Respuesta');const send=el('button','Guardar respuesta');send.type='button';
        let sending=false;
        send.onclick=async()=>{
          if(sending)return;
          sending=true;send.disabled=true;
          try{
            await run(async()=>{
              await repository.respond(projectId,row.id,response.value);
              response.value='';
              if(card.querySelector('[data-pqrs-timeline]')){
                try{await showTimeline();}
                catch{return 'Respuesta registrada. No se pudo actualizar el historial; pulsa «Ver historial».';}
              }
              return 'Respuesta registrada en el seguimiento de la PQRS.';
            });
          }finally{sending=false;if(send.isConnected)send.disabled=false;}
        };card.append(response,send);
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
  let submitting=false, pendingCase=null, lockedControls=[];
  form.onsubmit=e=>{
    e.preventDefault();
    if(submitting)return;
    submitting=true;
    const button=form.querySelector('[type="submit"]');
    button.disabled=true;
    run(async()=>{
      const files=selectedEvidence();
      if(files.length&&typeof repository.uploadEvidence!=='function')throw Error('No se puede radicar con adjuntos: el almacenamiento privado de evidencias PQRS no está habilitado todavía. Retira los archivos para continuar sin evidencia.');
      const payload=Object.fromEntries(new FormData(form));delete payload.evidence;
      if(!lockedControls.length){lockedControls=[...form.querySelectorAll('input:not([type=file]),select,textarea')].filter(control=>!control.disabled);for(const control of lockedControls)control.disabled=true;}
      const saved=pendingCase||await repository.create(projectId,payload,requestId);
      if(!saved?.id)throw Error('El servicio no confirmó el radicado. Conserva los datos y vuelve a intentar.');
      pendingCase=saved;
      if(files.length){
        // A failed upload keeps the confirmed case and files for a safe retry.
        try{await uploadPrivateEvidence({repository,projectId,caseId:saved.id,files});}
        catch(error){throw Error(`Radicado: ${saved.id}. Evidencias incompletas. ${error.message}`);}
      }
      pendingCase=null;
      requestId=crypto.randomUUID();
      form.reset();clearPreviews();evidenceList.replaceChildren();clearEvidence.hidden=true;
      const confirmation=`Radicado: ${saved.id} · ${statusLabels[saved.status]||saved.status}. ${repository.localDemo?'Guardado solo en este navegador. No se modificó PostgreSQL.':'Registro confirmado por PostgreSQL.'}`;
      try{await load();}catch{return confirmation+' No se pudo actualizar la lista. Pulsa Actualizar lista para consultar el radicado.';}
      return confirmation;
    }).finally(()=>{if(!pendingCase){for(const control of lockedControls)control.disabled=false;lockedControls=[];}submitting=false;button.disabled=false;});
  };
  root.querySelector('[data-new]').onclick=()=>{root.querySelector('form').scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});root.querySelector('form [name=kind]').focus();};
  root.querySelector('[data-refresh]').onclick=()=>run(load);filter.onchange=()=>run(load);run(load);
}
