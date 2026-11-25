import {bogotaAgendaDate,loadVerifiedAgenda,filterVerifiedAgenda,verifiedAgendaUiError} from './services/verified-agenda.js';
export function mountVerifiedAgenda(root,{repo,projectId,projectName}){
 root.innerHTML=`<section class="visit-workspace" aria-label="Agenda de reuniones verificadas">
 <header class="page-heading"><div><p class="eyebrow">OPERACIONES · CALENDARIO CORPORATIVO</p><h1>Agenda</h1><p data-agenda-property></p></div></header>
 <p class="notice">Consulta de reuniones verificadas · America/Bogota. La carga actual es puntual; no acredita sincronización periódica con Google Calendar.</p>
 <section class="panel"><h2>Centro de Inteligencia Directiva</h2>
 <p data-directive-brief aria-live="polite"></p>
 <details><summary>Consultar acompañamientos por tipo de reunión</summary><ul><li><strong>Consejo · Ordinario</strong> — Gerencia General, Gerencia Financiera</li>
<li><strong>Consejo · Extraordinario</strong> — Coordinación de Zona</li>
<li><strong>Consejo · Pre-Asamblea</strong> — Gerencia General, Gerencia Financiera, Coordinación General, Coordinación Operativa</li>
<li><strong>Consejo · Otro</strong> — Sin rol preasignado</li>
<li><strong>Asamblea · Ordinaria</strong> — Gerencia General, Gerencia Financiera, Coordinación General, Coordinación Operativa, Arquitectura</li>
<li><strong>Asamblea · Extraordinaria</strong> — Gerencia General, Gerencia Financiera, Coordinación General, Coordinación Operativa, Arquitectura, Coordinación de Zona</li>
<li><strong>Asamblea · Otra</strong> — Sin rol preasignado</li>
<li><strong>Comité · Financiero</strong> — Gerencia Financiera</li>
<li><strong>Comité · Convivencia</strong> — Coordinación de Zona</li>
<li><strong>Comité · De Obras</strong> — Coordinación Operativa, Arquitectura</li>
<li><strong>Comité · Otro</strong> — Sin rol preasignado</li></ul></details>
 <label>Abrir informe privado V4.0 desde este dispositivo<input type="file" accept=".html,text/html" data-report-file></label>
 <p data-report-status aria-live="polite"></p><div data-report-view></div></section>
 <section class="panel"><h2>Consultar compromisos</h2><div class="visit-filters">
 <label>Buscar en agenda<input type="search" data-agenda-search placeholder="Asunto, tipo o estado"></label>
 <label>Fecha en Colombia<input type="date" data-agenda-date></label>
 <label>Estado de reunión<select data-agenda-status><option value="">Todos</option></select></label>
 <button class="btn secondary" type="button" data-agenda-refresh>Actualizar consulta</button></div>
 <p data-agenda-message role="status" aria-live="polite"></p><ul class="visit-results" data-agenda-results></ul></section>
 <p class="muted">Miss ADPHOR puede orientar esta consulta. Reprogramación y cancelación no disponibles en esta versión: el servicio transaccional corporativo aún no está conectado.</p></section>`;
 root.querySelector('[data-agenda-property]').textContent=projectName||'Copropiedad seleccionada';
 const picker=root.querySelector('[data-report-file]');
 const reportStatus=root.querySelector('[data-report-status]');
 const reportView=root.querySelector('[data-report-view]');
 picker.addEventListener('change',async()=>{
  const file=picker.files[0];
  reportView.replaceChildren();
  reportStatus.textContent='';
  if(!file)return;
  try{
   if(file.size!==132157)throw new Error();
   const bytes=await file.arrayBuffer();
   const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes));
   if(Array.from(digest,b=>b.toString(16).padStart(2,'0')).join('')!=='ff7b7cc0cd3136dca0a73b15f3ecec8f8a672b70a9b6ac67e81b2498a827ad43')throw new Error();
   if(picker.files[0]!==file)return;
   const frame=document.createElement('iframe');
   frame.title='Informe privado del Centro de Inteligencia Directiva';
   frame.setAttribute('sandbox','allow-scripts allow-forms allow-downloads');
   frame.style.cssText='width:100%;height:75vh;border:0';
   const policy=`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; form-action 'none'; base-uri 'none'">`;
   frame.srcdoc=new TextDecoder().decode(bytes).replace('<head>','<head>'+policy);
   reportView.append(frame);
   reportStatus.textContent='Informe privado abierto. Corte del 24 de noviembre de 2026.';
  }catch{
   if(picker.files[0]===file)reportStatus.textContent='Selecciona el archivo original del Centro de Inteligencia Directiva V4.0.';
  }
 });
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
 const brief=root.querySelector('[data-directive-brief]');
 const load=async()=>{
  brief.textContent='';
  const id=++request;rows=[];loaded=false;list.replaceChildren();refresh.disabled=true;
  message.textContent='Consultando agenda autorizada…';
  try{
   const result=await loadVerifiedAgenda(repo,projectId);
   if(id!==request||!active())return;
   rows=result;loaded=true;state.replaceChildren(new Option('Todos',''));
   for(const value of new Set(rows.map(row=>row.source_status).filter(Boolean)))state.add(new Option(value,value));
   const now=new Date();
   const today=bogotaAgendaDate(now);
   const todayCount=rows.filter(row=>bogotaAgendaDate(row.start_at)===today).length;
   const next=rows.find(row=>new Date(row.start_at)>=now);
   brief.textContent='Reuniones verificadas que comienzan hoy: '+todayCount+'. '+
    (next?'Próxima reunión: '+next.title+' · '+formatter.format(new Date(next.start_at))+'.':'Sin próximas reuniones en la carga consultada.');
   render();
  }catch(error){
   if(id===request&&active())message.textContent=verifiedAgendaUiError(error);
  }finally{if(id===request&&active())refresh.disabled=false;}
 };
 for(const field of [search,date,state])field.addEventListener('input',render);
 refresh.addEventListener('click',load);load();
}
