import {QA_CADENCES,QA_CANDIDATE_STATUSES,validateTaskCandidate,validateQaCandidateRows} from './services/task-catalog.js';
const el=(tag,text='',className='')=>{
 const node=document.createElement(tag);node.textContent=String(text);
 if(className)node.className=className;
 return node;
};
function control(tag,name,value=''){
 const field=document.createElement(tag);field.name=name;if(value)field.value=value;return field;
}
function field(title,node,span=false){
 const label=el('label');if(span)label.className='span-all';
 label.append(el('span',title),node);return label;
}
function createProposalForm(onSubmit){
 const form=el('form','','panel qa-catalog-form adphor-simple-form');
 form.id='qa-catalog-proposal-form';
 const title=control('input','title');title.maxLength=120;title.required=true;
 const description=control('textarea','description');description.maxLength=1000;description.rows=3;
 const cadence=control('select','cadence');
 cadence.append(new Option('Seleccionar periodicidad propuesta',''));
 for(const [key,name] of Object.entries(QA_CADENCES))cadence.append(new Option(name,key));
 cadence.required=true;
 const submit=el('button','Presentar propuesta (sin programar)','btn primary');submit.type='submit';
 const msg=el('p','','span-all');msg.setAttribute('role','status');
 form.append(field('Actividad propuesta',title,true),
  field('Periodicidad tentativa',cadence),
  field('Descripción y evidencia requerida (sin datos privados)',description,true),submit,msg);
 let requestId=crypto.randomUUID();
 form.addEventListener('submit',async e=>{
  e.preventDefault();submit.disabled=true;msg.textContent='Guardando propuesta…';
  try{
   const payload=validateTaskCandidate({title:title.value,description:description.value,cadence:cadence.value});
   await onSubmit({...payload,id:requestId});
   requestId=crypto.randomUUID();form.reset();msg.textContent='Propuesta guardada. No se ha creado ninguna tarea recurrente.';
  }catch(_error){msg.textContent='No se pudo guardar la propuesta; revisa tu sesión, permisos y datos.';}
  finally{if(form.isConnected)submit.disabled=false;}
 });
 return form;
}
export function mountQaTaskCatalog(root,{repo,projectId,projectName,userId}={}){
 root.replaceChildren();
 const shell=el('section','','qa-task-catalog');
 const heading=el('header','','page-heading');
 const body=el('div');body.append(el('p','REVISIÓN HUMANA · QA INTEGRAL','eyebrow'),
 el('h1','Propuestas de actividades recurrentes'),
 el('p',projectName||'Copropiedad seleccionada','muted'));
 const back=el('button','Volver a Mis tareas','btn secondary');back.type='button';back.dataset.page='mine';
 heading.append(body,back);shell.append(heading);
 shell.append(el('p','Este registro prepara el catálogo para José y la coordinación. Una revisión favorable NO activa tareas, vencimientos, correos, Google Calendar ni automatizaciones.','notice qa-catalog-note'));
 const listTitle=el('h2','Propuestas y decisiones');
 const loadStatus=el('p','','muted');loadStatus.setAttribute('role','status');
 const list=el('div','','qa-catalog-list');
 const refresh=el('button','Actualizar propuestas','btn secondary');refresh.type='button';
 const panel=el('section','','panel');panel.append(listTitle,refresh,loadStatus,list);
 const active=()=>shell.isConnected;
 let token=0;
 async function load(){
  const current=++token;list.replaceChildren();loadStatus.textContent='Consultando propuestas autorizadas…';
  try {
   const rows=validateQaCandidateRows(await repo.listQaTaskCandidates(projectId),projectId);
   if(!active()||current!==token)return;
   if(!rows.length){loadStatus.textContent='No hay propuestas registradas para esta copropiedad.';return;}
   loadStatus.textContent=rows.length+' propuestas con origen QA verificado.';
   for(const row of rows){
    const card=el('article','','qa-catalog-card');
    const meta=el('div','','qa-catalog-meta');
    meta.append(el('span',QA_CADENCES[row.cadence]),el('span',QA_CANDIDATE_STATUSES[row.status]));
    card.append(el('strong',row.title),meta,el('p',row.description||'Sin descripción adicional.'),
      el('small','Presentada: '+(row.created_at||'Fecha no disponible')));
    if(row.review_note)card.append(el('p','Observación de revisión: '+row.review_note));
    if(row.status==='proposed'&&row.created_by!==userId){
     const review=el('div','','qa-catalog-review');
     const note=control('textarea','note');note.maxLength=1000;note.rows=2;
     review.append(field('Motivo de revisión (mínimo 5 caracteres)',note));
     const actions=el('div','','qa-catalog-actions');
     for(const [decision,label] of [['reviewed_for_design','Revisar para diseño'],['rejected','Devolver propuesta']]){
      const button=el('button',label,'btn secondary');button.type='button';
      button.addEventListener('click',async()=>{
       button.disabled=true;
       try{
        if(note.value.trim().length<5)throw Error('Motivo insuficiente');
        await repo.reviewQaTaskCandidate(projectId,row.id,decision,note.value);
        await load();
       }catch{loadStatus.textContent='No se registró la decisión. Comprueba permisos y justificación.';}
       finally{if(button.isConnected)button.disabled=false;}
      });
      actions.append(button);
     }
     review.append(actions);card.append(review);
    } else if(row.status==='proposed'&&row.created_by===userId){
     card.append(el('p','Pendiente de otra persona autorizada para revisar; no admite autoaprobación.','muted'));
    }
    list.append(card);
   }
  }catch{if(active()&&current===token)loadStatus.textContent='Catálogo QA no disponible o permisos insuficientes. No se mostrará una lista vacía como si fuera completa.';}
 }
 refresh.addEventListener('click',load);
 shell.append(createProposalForm(async payload=>{
  await repo.proposeQaTaskCandidate(projectId,payload);
  await load();
 }),panel);
 root.append(shell);void load();
}
