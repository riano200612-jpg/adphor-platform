// Fixture UI. The shared application does not import this module.
export function mountIsolatedAgenda(root,{event,actor,service}) {
  root.innerHTML='<section><h2>Agenda simulada · QA aislado</h2><p data-event></p><form><label>Operación<select name="action"><option value="reschedule">Reprogramar</option><option value="cancel">Cancelar</option></select></label><label>Inicio ISO con zona<input name="start"></label><label>Fin ISO con zona<input name="end"></label><button>Revisar cambio</button></form><p data-summary></p><button type="button" data-confirm hidden>Confirmar cambio simulado</button><p role="status"></p></section>';
  root.querySelector('[data-event]').textContent=[event.id,event.status,event.start,event.end].filter(Boolean).join(' · ');
  const form=root.querySelector('form');
  const summary=root.querySelector('[data-summary]');
  const status=root.querySelector('[role=status]');
  const confirm=root.querySelector('[data-confirm]');
  let request;
  let running=false;
  let finished=false;
  form.addEventListener('input',()=>{
    request=undefined;
    confirm.hidden=true;
    summary.textContent='';
  });
  form.addEventListener('submit',e=>{
    e.preventDefault();
    if(running || finished)return;
    const {action,start,end}=Object.fromEntries(new FormData(form));
    if(action==='reschedule' && !(Number.isFinite(Date.parse(start)) && Date.parse(end)>Date.parse(start))){
      status.textContent='Miss ADPHOR · Revisa el intervalo y su zona horaria.';
      return;
    }
    request ??= {actor,projectId:event.projectId,eventId:event.id,version:event.version,
      requestId:crypto.randomUUID(),action,start,end,confirmed:true};
    summary.textContent=action==='cancel'
      ? 'La simulación marcará el evento como cancelado y conservará su identificador.'
      : 'La simulación actualizará el mismo evento: '+start+' → '+end;
    status.textContent='Miss ADPHOR · Revisa los datos antes de confirmar.';
    confirm.hidden=false;
  });
  confirm.addEventListener('click',async()=>{
    if(!request || running || finished)return;
    running=true;
    confirm.disabled=true;
    for(const field of form.elements)field.disabled=true;
    status.textContent='Procesando el cambio simulado…';
    try {
      const result=await service.run(request);
      if(result?.eventId!==event.id || result.simulated!==true) throw Error('Unverified result');
      if(result.state==='confirmed' && result.version){
        finished=true;
        status.textContent='Cambio simulado confirmado. Evento '+event.id+' · versión '+result.version;
        confirm.hidden=true;
      } else {
        status.textContent='Resultado incierto. Confirma nuevamente para reconciliar la misma operación.';
      }
    } catch(error) {
      status.textContent=/conflict/i.test(error.message)
        ? 'Conflicto. Actualiza el evento antes de preparar otro cambio.'
        : 'No se pudo confirmar el cambio simulado.';
    } finally {
      running=false;
      confirm.disabled=false;
      for(const field of form.elements)field.disabled=finished;
    }
  });
}
