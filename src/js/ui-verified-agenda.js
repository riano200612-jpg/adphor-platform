import {loadVerifiedAgenda,filterVerifiedAgenda} from './services/verified-agenda.js';
export function mountVerifiedAgenda(root,{repo,projectId,projectName}){
 root.innerHTML=`<section class="visit-workspace" aria-label="Agenda de reuniones verificadas">
 <header class="page-heading"><div><p class="eyebrow">OPERACIONES · CALENDARIO CORPORATIVO</p><h1>Agenda</h1><p data-agenda-property></p></div></header>
 <p class="notice">Consulta de reuniones verificadas · America/Bogota. La carga actual es puntual; no acredita sincronización periódica con Google Calendar.</p>
 <section class="panel"><h2>Consultar compromisos</h2><div class="visit-filters">
 <label>Buscar en agenda<input type="search" data-agenda-search placeholder="Asunto, tipo o estado"></label>
 <label>Fecha en Colombia<input type="date" data-agenda-date></label>
 <label>Estado de reunión<select data-agenda-status><option value="">Todos</option></select></label>
 <button class="btn secondary" type="button" data-agenda-refresh>Actualizar consulta</button></div>
 <p data-agenda-message role="status" aria-live="polite"></p><ul class="visit-results" data-agenda-results></ul></section>
 <p class="muted">Miss ADPHOR puede orientar esta consulta. Reprogramación y cancelación no disponibles en esta versión: el servicio transaccional corporativo aún no está conectado.</p></section>`;
 root.querySelector('[data-agenda-property]').textContent=projectName||'Copropiedad seleccionada';
 const message=root.querySelector('[data-agenda-message]');
 const list=root.querySelector('[data-agenda-results]');
 const search=root.querySelector('[data-agenda-search]');
 const date=root.querySelector('[data-agenda-date]');
 const state=root.querySelector('[data-agenda-status]');
 const refresh=root.querySelector('[data-agenda-refresh]');
 let rows=[],request=0,loaded=false;
 const active=()=>message.isConnected&&list.isConnected;
 const formatter=new Intl.DateTimeFormat('es-CO',{timeZone:'America/Bogota',dateStyle:'medium',timeStyle:'short'});
 const render=()=>{
  if(!loaded)return;
  const visible=filterVerifiedAgenda(rows,{search:search.value,date:date.value,status:state.value});
  list.replaceChildren();
  for(const row of visible){
   const item=document.createElement('li');
   const title=document.createElement('strong');title.textContent=row.title||'Reunión sin título';
   const details=document.createElement('p');details.textContent=[row.kind,row.source_status,formatter.formatRange(new Date(row.start_at),new Date(row.end_at))].filter(Boolean).join(' · ');
   item.append(title,details);list.append(item);
  }
  message.textContent=visible.length?`${visible.length} reuniones verificadas para esta copropiedad.`:rows.length?'No hay reuniones que coincidan con los filtros.':'No hay reuniones verificadas para esta copropiedad.';
 };
 const load=async()=>{
  const id=++request;rows=[];loaded=false;list.replaceChildren();refresh.disabled=true;
  message.textContent='Consultando agenda autorizada…';
  try{
   const result=await loadVerifiedAgenda(repo,projectId);
   if(id!==request||!active())return;
   rows=result;loaded=true;state.replaceChildren(new Option('Todos',''));
   for(const value of new Set(rows.map(row=>row.source_status).filter(Boolean)))state.add(new Option(value,value));
   render();
  }catch{
   if(id===request&&active())message.textContent='No se pudo consultar la agenda. Verifica tu sesión y la habilitación del calendario; puedes volver a intentarlo.';
  }finally{if(id===request&&active())refresh.disabled=false;}
 };
 for(const field of [search,date,state])field.addEventListener('input',render);
 refresh.addEventListener('click',load);load();
}
