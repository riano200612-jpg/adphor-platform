import {mountVisitEvidence} from './ui-visit-evidence.js';

export function canAttachVisitEvidence(row,repository,canWrite){
 return canWrite===true &&
  ['programada','en_ejecucion'].includes(row?.status) &&
  typeof repository?.evidence?.uploadEvidence==='function' &&
  typeof repository?.evidence?.listEvidence==='function' &&
  typeof repository?.evidence?.signedEvidence==='function';
}
import {visitActions,visitLocalDate,visitStates,visitTransitionPayload} from './services/visit-lifecycle.js';

// Every value from SQL is assigned with textContent/value, never interpolated HTML.
export function mountVisitLifecycle(item,{row,repository,canWrite,responsibleNames,reload}){
 const section=document.createElement('details');
 const heading=document.createElement('summary');
 heading.textContent='Seguimiento · '+visitStates[row.status];section.append(heading);
 const info=document.createElement('p');
 const time=value=>value?new Intl.DateTimeFormat('es-CO',{timeZone:'America/Bogota',dateStyle:'medium',timeStyle:'short'}).format(new Date(value)):'Pendiente';
 info.textContent=`Ingreso: ${time(row.started_at)} · Salida: ${time(row.finished_at)} · Versión ${row.version}`;section.append(info);
 const form=document.createElement('fieldset');form.className='visit-fields';
 const inputs={};
 function field(name,label,value,{multiline=false,max=4000,type='text'}={}){
  const wrapper=document.createElement('label');wrapper.textContent=label;
  const input=document.createElement(multiline?'textarea':'input');
  if(!multiline)input.type=type;
  input.value=value??'';input.maxLength=max;inputs[name]=input;wrapper.append(input);form.append(wrapper);return input;
 }
 if(row.status==='programada'){
  field('kind','Editar motivo',row.motive,{max:200});
  field('start','Editar fecha y hora (Colombia)',visitLocalDate(row.scheduled_at),{type:'datetime-local'});
  const label=document.createElement('label');label.textContent='Editar responsable';
  const select=document.createElement('select');inputs.responsibleId=select;
  for(const [id,name] of responsibleNames)select.add(new Option(name,id));
  select.value=row.responsible_id;label.append(select);form.append(label);
 }
 if(row.status!=='programada')for(const [key,label] of Object.entries({observations:'Observaciones',activities:'Actividades realizadas',conclusions:'Conclusiones',commitments:'Compromisos y seguimiento'})){
  field(key,label,row[key],{multiline:true}).readOnly=row.status!=='en_ejecucion';
 }
 const actions=canWrite?visitActions(row.status):[];
 if(actions.includes('cancel'))field('reason','Motivo de cancelación','',{max:1000,multiline:true});
 if(row.cancellation_reason){const reason=document.createElement('p');reason.textContent='Cancelación: '+row.cancellation_reason;section.append(reason);}
 const message=document.createElement('p');message.setAttribute('role','status');
 const buttons=document.createElement('div');buttons.className='visit-actions';
 let busy=false;
 const requests=new Map();
 const names={edit:'Guardar cambios',start:'Registrar ingreso',progress:'Guardar seguimiento',finish:'Registrar salida y completar',cancel:'Cancelar visita'};
 for(const action of actions){
  const button=document.createElement('button');button.type='button';button.textContent=names[action];buttons.append(button);
  button.addEventListener('click',async()=>{
   if(busy)return;
   const values=Object.fromEntries(Object.entries(inputs).map(([k,v])=>[k,v.value]));
   let key;
   try{key=JSON.stringify([action,row.version,visitTransitionPayload(action,values)]);}catch(error){message.textContent=error.message;return;}
   if(!requests.has(key))requests.set(key,crypto.randomUUID());
   busy=true;form.disabled=true;message.textContent='Confirmando operación…';
   try{
    await repository.transition({projectId:row.project_id,requestId:row.request_id,operationId:requests.get(key),version:row.version,status:row.status,action,values});
    message.textContent='Operación confirmada en SQL.';
    await reload();
   }catch{
    message.textContent='No se pudo confirmar la operación. Reintenta sin cambiar los datos; si la visita cambió, vuelve a consultarla.';
   }finally{busy=false;form.disabled=false;}
  });
 }
 form.append(buttons);if(!canWrite)form.disabled=true;
 section.append(form,message);
 const historyButton=document.createElement('button');historyButton.type='button';historyButton.textContent='Consultar historial';
 const history=document.createElement('ol');
 historyButton.addEventListener('click',async()=>{
  historyButton.disabled=true;history.replaceChildren();
  try{
   const events=await repository.history(row.project_id,row.request_id);
   for(const event of events){
    const li=document.createElement('li');
    const label={create:'Programación',baseline:'Registro previo',edit:'Edición',start:'Ingreso',progress:'Seguimiento',finish:'Salida y cierre',cancel:'Cancelación'}[event.action]??'Operación';
    li.textContent=`${time(event.occurred_at)} · ${label} · ${responsibleNames.get(event.actor_id)??event.actor_id} · Versión ${event.version}`;
    history.append(li);
   }
  }catch{history.textContent='No se pudo consultar el historial. Reintenta.';}
  finally{historyButton.disabled=false;}
 });
 section.append(historyButton,history);
 if(repository.evidence){
  mountVisitEvidence(section,{row,evidence:repository.evidence,canWrite});
  // Make uploads discoverable without bypassing the existing AAL2, role,
  // per-property, visit-state and private Storage checks.
  if(canAttachVisitEvidence(row,repository,canWrite)){
   const attachButton=document.createElement('button');attachButton.type='button';
   attachButton.className='btn secondary visit-attach-shortcut';
   attachButton.dataset.visitAttachShortcut='';
   attachButton.textContent='Adjuntar imágenes o documentos';
   attachButton.addEventListener('click',()=>{
    section.open=true;
    section.querySelector('.visit-evidence input[type="file"]')?.focus();
   });
   item.append(attachButton);
  }
 }else{
  const attachments=document.createElement('p');attachments.className='muted';
  attachments.textContent='Los adjuntos privados de Visitas están pendientes de habilitación; no se cargarán archivos desde esta pantalla.';
  section.append(attachments);
 }
 item.append(section);
}
