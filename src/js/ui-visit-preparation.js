import {mountProjectSelector} from './ui-project-selector.js';

export function visitDraftGuidance({projectId, kind, start, responsibleId, allowedResponsibleIds}) {
  if (!projectId) return 'Selecciona una copropiedad asignada.';
  if (!kind.trim()) return 'Indica el tipo o motivo de la visita.';
  if (!start) return 'Indica la fecha y hora de la visita.';
  if (!allowedResponsibleIds.includes(responsibleId)) return 'Selecciona un responsable autorizado de esta copropiedad.';
  return 'Revisa la copropiedad, el motivo, la fecha y el responsable. El registro SQL aún no está habilitado.';
}

export function mountVisitPreparation(root, {projectId, projectName, members, projects, onProjectChange, isolatedRepository, visitRepository, canCreate=true}) {
  const repository=visitRepository??isolatedRepository;
  const shared=Boolean(visitRepository);
  root.innerHTML = `<section class="visit-workspace" aria-label="Gestión de visitas">
    <header class="page-heading"><div><p class="eyebrow">OPERACIONES · GESTIÓN DE COPROPIEDADES</p>
      <h1>Visitas</h1><p data-property></p></div>
      <p class="visit-badge">${shared?'Visitas programadas':'Preparación QA'}</p></header>
    <div class="visit-metrics" aria-label="Indicadores">
      <div class="panel"><span>Copropiedades asignadas</span><strong data-project-count></strong></div>
      <div class="panel"><span>Responsables de la copropiedad</span><strong data-staff-count></strong></div>
      <div class="panel"><span>${shared?'Visitas consultadas':'Borradores consultados'}</span><strong data-visit-count>—</strong></div>
    </div>
    <div class="visit-columns">
      <section class="panel visit-editor" aria-labelledby="visit-editor-title">
        <h2 id="visit-editor-title">Preparar visita</h2>
        <p class="muted">Completa los datos y revisa el borrador. Si cambias de copropiedad, se descarta la preparación actual.</p>
        <div data-visit-project></div>
        <fieldset><legend>1. Datos de la visita</legend><div class="visit-fields">
          <label>Tipo o motivo<input name="kind" maxlength="200" required placeholder="Ej. Inspección de zonas comunes"></label>
          <label>Fecha y hora (Colombia)<input name="start" type="datetime-local" required></label>
          <label>Responsable<select name="responsible" required><option value="">Seleccionar</option></select></label>
        </div></fieldset>
        <details><summary>Observaciones, seguimiento y resultado</summary><p class="muted">Estos datos corresponden al ciclo posterior de la visita. Se habilitarán cuando se apruebe el contrato de registro e historial.</p></details>
        <div class="visit-actions"><button class="btn primary" type="button" data-review disabled>${shared?'Revisar visita':'Revisar borrador'}</button></div>
        <p data-summary role="status"></p>
        <details data-visit-guide><summary>Miss ADPHOR · Guía de Visitas</summary><p aria-live="polite"></p></details>
      </section>
      <section class="panel" aria-labelledby="visit-list-title">
        <h2 id="visit-list-title">${shared?'Visitas registradas':'Borradores de visitas'}</h2>
        <div class="visit-fields" data-list-filters hidden>
          <label>Buscar visitas<input type="search" data-visit-search placeholder="Motivo o radicado"></label>
          <label>Filtrar por fecha<input type="date" data-visit-date></label>
          <label>Filtrar por responsable<select data-visit-responsible><option value="">Todos</option></select></label>
        </div>
        <p data-list-status role="status"></p><ul class="visit-results" data-visit-results></ul>
      </section>
    </div></section>`;
  root.querySelector('[data-property]').textContent = projectName || 'Selecciona una copropiedad asignada';
  root.querySelector('[data-project-count]').textContent = projects?.length ?? Number(Boolean(projectId));
  if (projects && onProjectChange) {
    mountProjectSelector(root.querySelector('[data-visit-project]'), {
      projects, selected: projectId, selectId:'visit-project-select', onChange:onProjectChange
    });
  }
  const fields = root.querySelector('fieldset');
  const select = fields.querySelector('[name=responsible]');
  const allowedResponsibleIds = [];
  for (const member of members) {
    if (member.project_id !== projectId || !member.user_id || !member.name) continue;
    if (allowedResponsibleIds.includes(member.user_id)) continue;
    allowedResponsibleIds.push(member.user_id);
    select.add(new Option(member.name, member.user_id));
  }
  root.querySelector('[data-staff-count]').textContent = allowedResponsibleIds.length;
  const guide = root.querySelector('[data-visit-guide]');
  const listStatus=root.querySelector('[data-list-status]');
  const results=root.querySelector('[data-visit-results]');
  const search=root.querySelector('[data-visit-search]');
  const date=root.querySelector('[data-visit-date]');
  const responsibleFilter=root.querySelector('[data-visit-responsible]');
  const responsibleNames=new Map([...select.options].filter(option=>option.value).map(option=>[option.value,option.textContent]));
  for(const [id,name] of responsibleNames)responsibleFilter.add(new Option(name,id));
  const canList=typeof repository?.list==='function';
  let rows=[],listRevision=0,listLoaded=false;
  const dateFormat=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Bogota',year:'numeric',month:'2-digit',day:'2-digit'});
  const localDate=row=>dateFormat.format(new Date(row.scheduled_at));
  const drawList=()=>{
    if(!listLoaded)return;
    const term=search.value.trim().toLocaleLowerCase('es');
    const visible=rows.filter(row=>(!date.value || localDate(row)===date.value) &&
      (!responsibleFilter.value || row.responsible_id===responsibleFilter.value) &&
      (row.motive+' '+row.request_id).toLocaleLowerCase('es').includes(term));
    results.replaceChildren();
    for(const row of visible){
      const item=document.createElement('li');
      const title=document.createElement('strong');
      title.textContent=row.motive;
      const details=document.createElement('small');
      details.textContent=[localDate(row),responsibleNames.get(row.responsible_id) || 'Responsable no disponible',row.request_id].join(' · ');
      item.append(title,details);
      results.append(item);
    }
    listStatus.textContent=visible.length ? visible.length+(shared?' visitas visibles.':' borradores visibles.') :
      rows.length ? (shared?'Ninguna visita coincide con los filtros.':'Ningún borrador coincide con los filtros.') : (shared?'Todavía no hay visitas registradas.':'Todavía no hay borradores guardados.');
  };
  async function loadList(){
    const revision=++listRevision;listLoaded=false;
    listStatus.textContent=shared?'Consultando visitas…':'Consultando borradores…';
    try {
      const result=await repository.list(projectId);
      if(revision!==listRevision||!listStatus.isConnected)return;
      rows=result.filter(row=>row.project_id===projectId &&
        Number.isFinite(Date.parse(row.scheduled_at)));
      listLoaded=true;
      root.querySelector('[data-visit-count]').textContent=rows.length;
      drawList();
    } catch {
      if(revision!==listRevision||!listStatus.isConnected)return;
      listStatus.textContent=shared?'No se pudieron consultar las visitas. Vuelve a abrir Visitas para reintentar.':'No se pudieron consultar los borradores. Vuelve a abrir Visitas para reintentar.';
    }
  }
  if(canList){
    root.querySelector('[data-list-filters]').hidden=false;
    search.addEventListener('input',drawList);
    date.addEventListener('input',drawList);
    responsibleFilter.addEventListener('change',drawList);
    loadList();
  }else{
    listStatus.textContent='La consulta de visitas guardadas aún no está habilitada en el portal compartido.';
  }
  const review = root.querySelector('[data-review]');
  const summary = root.querySelector('[data-summary]');
  const draft = () => ({
      projectId, kind: fields.querySelector('[name=kind]').value,
      start: fields.querySelector('[name=start]').value,
      responsibleId: select.value, allowedResponsibleIds
  });
  const ready = data => Boolean(data.projectId && data.kind.trim() && data.start &&
    allowedResponsibleIds.includes(data.responsibleId));
  const update = () => {
    const data = draft();
    review.disabled = !ready(data)||(shared&&!canCreate);
    if (guide.open) guide.querySelector('p').textContent = shared&&!canCreate?'Consulta disponible. El registro requiere habilitación de escritura y rol de Administración o Coordinación.':shared&&ready(data)?'Revisa los datos y confirma para registrar la visita en QA.':visitDraftGuidance(data);
  };
  review.addEventListener('click', () => {
    const data = draft();
    if (!ready(data)) return;
    summary.textContent = [projectName, data.kind.trim(), data.start.replace('T', ' ') + ' (Colombia)',
      select.selectedOptions[0].textContent, shared?'Visita revisada. Confirma para registrarla.':'Borrador revisado. La visita no se guardó.'].join(' · ');
  });
  // Shared QA and isolated tests use the same reviewed form contract.
  if (repository && canCreate) {
    const save = document.createElement('button');
    save.type = 'button';
    save.textContent = shared?'Confirmar y registrar visita':'Confirmar y guardar borrador de prueba';
    save.hidden = true;
    summary.before(save);
    let reviewed;
    let saving = false;
    review.addEventListener('click', () => {
      const data = draft();
      if (saving || !ready(data)) return;
      reviewed ??= {...data, requestId: crypto.randomUUID()};
      save.hidden = false;
    });
    fields.addEventListener('input', () => {
      reviewed = undefined;
      save.hidden = true;
    });
    save.addEventListener('click', async () => {
      if (!reviewed || saving) return;
      const request = reviewed;
      saving = true;
      save.disabled = true;
      fields.disabled = true;
      summary.textContent = shared?'Registrando visita…':'Guardando borrador de prueba…';
      try {
        const saved = await repository.save(request);
        if (saved?.request_id !== request.requestId || saved.project_id !== projectId) {
          throw new Error('Invalid persistence confirmation');
        }
        if (summary.isConnected) summary.textContent = shared?'Programación de visita guardada en SQL. No registra ejecución, ingreso ni salida.':'Borrador de prueba guardado y confirmado.';
        save.hidden = true;
        if(canList) await loadList();
      } catch {
        if (summary.isConnected) summary.textContent = 'No se pudo confirmar el guardado. Reintenta con el mismo borrador.';
      } finally {
        saving = false;
        save.disabled = false;
        fields.disabled = false;
      }
    });
  }
  guide.addEventListener('toggle', update);
  fields.addEventListener('input', () => {
    summary.textContent = '';
    update();
  });
}
