import {missTaskList,missTaskPlan} from './services/miss-task-actions.js';

// Visible user-initiated task launchers. No automatic submission or API calls.
export function mountMissTaskHub(panel,{context,documentsEnabled=false,composer,onNavigate,onInfo}={}) {
 if(!panel || typeof panel.append!=='function' || typeof panel.querySelector!=='function' ||
    typeof context!=='function' || typeof onNavigate!=='function')return null;
 const initial=context();
 if(initial?.mode!=='cloud')return null;
 const section=document.createElement('section');
 section.className='miss-task-hub';
 section.setAttribute('aria-label','Acciones de Miss ADPHOR');
 const title=document.createElement('h3');title.textContent='¿Qué necesitas hacer?';
 const hint=document.createElement('p');
 hint.textContent='Te llevo al formulario autorizado. Nada se guarda ni se envía sin tu confirmación.';
 hint.className='miss-task-help';
 const tasks=document.createElement('div');tasks.className='miss-task-grid';
 for(const task of missTaskList(initial,{documentsEnabled})){
  // A restricted action is not offered to the user; document readiness remains
  // visible so a disabled QA feature is never confused with a successful upload.
  if(!task.enabled && task.id!=='document')continue;
  const button=document.createElement('button');
  button.type='button';
  button.className='miss-task-button';
  button.dataset.missTask=task.id;
  button.textContent=task.enabled?task.label:
   'Documentos · pendiente';
  if(!task.enabled)button.setAttribute('aria-description','Pendiente de certificación de seguridad');
  button.addEventListener('click',()=>{
   const decision=missTaskPlan(context(),task.id,{documentsEnabled});
   if(!decision.ok){onInfo?.(decision.message);return;}
   if(task.id==='document'){
    if(composer && composer.isConnected){
     composer.open=true;
     composer.querySelector('input[type=file]')?.focus();
    }else onInfo?.('La recepción de archivos no está disponible en esta sesión.');
    return;
   }
   onNavigate(decision.page,decision.id);
  });
  tasks.append(button);
 }
 section.append(title,hint,tasks);
 const form=panel.querySelector('.miss-chat-form');
 if(form&&typeof form.before==='function')form.before(section);
 else panel.append(section);
 const quick=panel.querySelector('.miss-chat-quick');
 if(quick && typeof quick.replaceWith==='function'){
  const more=document.createElement('details');more.className='miss-chat-more';
  const summary=document.createElement('summary');
  summary.textContent='Consultas rápidas y guías';
  quick.replaceWith(more);
  more.append(summary,quick);
 }
 return section;
}
