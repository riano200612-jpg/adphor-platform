// Uses the current ADPHOR shell/styles; all untrusted strings rendered as text.
export function mountPqrs(root,{repository,projectId,members=[],role}) {
  root.innerHTML='<section class="panel"><h2>PQRS · Piloto QA</h2><p>Casos sintéticos. Los datos importados siguen en conciliación.</p><p role="status"></p><label>Estado <select data-filter><option value="">Todos</option><option>open</option><option>assigned</option><option>in_progress</option><option>resolved</option><option>closed</option></select></label><button data-refresh>Actualizar</button><form><label>Tipo<select name="kind"><option value="peticion">Petición</option><option value="queja">Queja</option><option value="reclamo">Reclamo</option><option value="sugerencia">Sugerencia</option></select></label><label>Asunto<input name="subject" required minlength="3" maxlength="200"></label><label>Torre<input name="tower" maxlength="40" placeholder="Ej. Torre 1"></label><label>Apartamento<input name="apartment" maxlength="40" placeholder="Ej. 402"></label><label>Propietario o solicitante<input name="owner" maxlength="120" placeholder="Nombre autorizado"></label><label>Detalle<textarea name="description" required minlength="3" maxlength="6000"></textarea></label><button>Radicar PQRS</button></form><p>Adjuntos: carga bloqueada hasta validar Storage privado en QA.</p><div data-cases></div></section>';
  const message=root.querySelector('[role=status]'),list=root.querySelector('[data-cases]'),filter=root.querySelector('[data-filter]');
  let requestId=crypto.randomUUID();
  const run=async f=>{try{message.textContent='Procesando…';await f();message.textContent=repository.localDemo?'Cambio guardado en este navegador (demo). No se modificó PostgreSQL.':'Operación confirmada por PostgreSQL.';}catch(e){message.textContent=e.message;}};
  const el=(tag,text)=>{const n=document.createElement(tag);n.textContent=text;return n;};
  async function load(){
    const rows=await repository.list(projectId,filter.value);if(!root.isConnected)return;list.replaceChildren();
    for(const row of rows){
      const card=el('article','');card.className='panel';card.append(el('h3',row.subject),el('p',[row.tower&&'Torre '+row.tower,row.apartment&&'Apto '+row.apartment,row.owner&&'Solicitante '+row.owner].filter(Boolean).join(' · ')),el('p',row.description),el('p',`${row.status} · ${row.priority} · versión ${row.version}`));
      const history=el('button','Ver historial');history.onclick=()=>run(async()=>{const events=await repository.history(projectId,row.id);let box=card.querySelector('pre');if(!box){box=el('pre','');card.append(box);}box.textContent=events.map(e=>`${e.occurred_at}: ${e.old_status||'creado'} → ${e.new_status}`).join('\n');});card.append(history);
      if(row.status!=='closed'){
        const response=el('textarea','');response.setAttribute('aria-label','Respuesta');const send=el('button','Guardar respuesta');send.onclick=()=>run(async()=>{await repository.respond(projectId,row.id,response.value);response.value='';});card.append(response,send);
        const status=el('select','');status.setAttribute('aria-label','Nuevo estado');for(const value of ['open','assigned','in_progress','resolved',...(role==='admin'?['closed']:[])]){const o=el('option',value);o.value=value;o.selected=value===row.status;status.append(o);}
        const assignee=el('select','');assignee.setAttribute('aria-label','Responsable');assignee.append(el('option',''));for(const m of members){const o=el('option',m.name||m.user_id);o.value=m.user_id;o.selected=m.user_id===row.assignee;assignee.append(o);}assignee.disabled=!['admin','coordinator'].includes(role);
        const solution=el('textarea',row.solution||'');solution.setAttribute('aria-label','Solución');const save=el('button','Guardar seguimiento');save.onclick=()=>run(async()=>{const patch={status:status.value,solution:solution.value};if(!assignee.disabled)patch.assignee=assignee.value||null;await repository.update(projectId,row.id,row.version,patch);await load();});card.append(status,assignee,solution,save);
      }
      list.append(card);
    }
    if(rows.length===200)list.append(el('p','Se muestran los 200 casos más recientes. Aplica un filtro.'));
    if(!rows.length)list.append(el('p','Sin casos visibles para este filtro.'));
  }
  root.querySelector('form').onsubmit=e=>{e.preventDefault();const form=e.currentTarget,button=form.querySelector('button');button.disabled=true;run(async()=>{await repository.create(projectId,Object.fromEntries(new FormData(form)),requestId);requestId=crypto.randomUUID();form.reset();await load();}).finally(()=>button.disabled=false);};
  root.querySelector('[data-refresh]').onclick=()=>run(load);filter.onchange=()=>run(load);run(load);
}
