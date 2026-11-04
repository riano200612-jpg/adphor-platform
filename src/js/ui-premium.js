import {searchProjects} from './ui-project-selector.js';
import {STATES, metrics} from './core/workflow.js';
export function operationalChart(rows) {
 return `<div aria-label="Distribución de casos por estado">${STATES.map(s=>{const count=rows.filter(r=>r.status===s).length;return `<button class="chart-row" data-status="${s}" aria-label="${s}: ${count} casos"><span>${s}</span><div class="chart-track"><div class="chart-fill" style="width:${rows.length?100*count/rows.length:0}%"></div></div><strong>${count}</strong></button>`;}).join('')}</div><p class="chart-note">Estado actual · ${rows.length} registros de esta copropiedad. No representa una tendencia histórica.</p>`;
}
export function mountPropertyCatalog(root,{projects,tickets,members,onSelect}) {
 root.innerHTML='<div class="page-heading"><div><p class="eyebrow">TU PORTAFOLIO AUTORIZADO</p><h1>Copropiedades</h1><p class="muted">Cada comunidad, una operación conectada. Selecciona su ficha para consultar el seguimiento.</p></div></div><div class="catalog-toolbar"><label class="full">Buscar en el catálogo<input type="search" placeholder="Nombre de la copropiedad" aria-label="Buscar en el catálogo"></label><p role="status"></p></div><div class="catalog-grid"></div>';

 // ADPHOR_PROPERTY_CAROUSEL_V1
 const carousel=document.createElement('nav');
 carousel.className='property-carousel-controls';
 carousel.setAttribute('aria-label','Navegación de copropiedades');
 const previous=document.createElement('button');
 previous.type='button';
 previous.textContent='← Anterior';
 const counter=document.createElement('span');
 counter.setAttribute('aria-live','polite');
 const next=document.createElement('button');
 next.type='button';
 next.textContent='Siguiente →';
 carousel.append(previous,counter,next);
 root.querySelector('.catalog-toolbar').after(carousel);

 let activeIndex=0;

 function updateCarousel(){
   const cards=[...grid.querySelectorAll('.property-card')];
   if(!cards.length){
     counter.textContent='Sin copropiedades';
     previous.disabled=true;
     next.disabled=true;
     return;
   }
   activeIndex=Math.max(0,Math.min(activeIndex,cards.length-1));
   counter.textContent=`${activeIndex+1} de ${cards.length}`;
   previous.disabled=activeIndex===0;
   next.disabled=activeIndex===cards.length-1;
 }

 function moveCarousel(delta){
   const cards=[...grid.querySelectorAll('.property-card')];
   if(!cards.length)return;
   activeIndex=Math.max(0,Math.min(activeIndex+delta,cards.length-1));
   updateCarousel();
   cards[activeIndex].scrollIntoView({
     behavior:'smooth',
     block:'nearest',
     inline:'center'
   });
 }

 previous.onclick=()=>moveCarousel(-1);
 next.onclick=()=>moveCarousel(1);
 const grid=root.querySelector('.catalog-grid'),search=root.querySelector('input'),status=root.querySelector('[role=status]');
 const node=(tag,text)=>{const n=document.createElement(tag);n.textContent=text;return n;};
 function render(){const visible=searchProjects(projects,search.value);grid.replaceChildren();status.textContent=`${visible.length} de ${projects.length} autorizadas`;
  for(const p of visible){const c=node('article','');c.className='property-card';const art=node('div','');art.className='property-art';art.innerHTML='<i class="fa-solid fa-building" aria-hidden="true"></i><small>ADPHOR · Copropiedad</small>';c.append(art);const body=node('div','');body.className='property-body';body.append(node('h2',p.name),node('p',p.location||'Ubicación pendiente de registro'));
   const m=metrics(tickets.filter(t=>t.project_id===p.id));const dl=node('dl','');for(const [key,val]of [['Pendientes visibles',m.pending],['Cerrados visibles',m.closed],['Áreas',p.areas?.length??'Sin registro'],['Unidades',p.units??'Sin registro']]){const d=node('div','');d.append(node('dt',key),node('dd',String(val)));dl.append(d);}body.append(dl);const manager=members.find(x=>x.project_id===p.id&&['admin','coordinator'].includes(x.role));body.append(node('p',`Responsable: ${manager?.name||'Sin responsable visible'}`));const b=node('button','Abrir ficha operativa →');b.className='btn secondary full';b.onclick=()=>onSelect(p.id);body.append(b);c.append(body);grid.append(c);}
  if(!visible.length){const empty=node('p','No encontramos coincidencias. Prueba otro nombre.');empty.className='notice';grid.append(empty);}}
 search.oninput=()=>{activeIndex=0;render();updateCarousel();};render();updateCarousel();
}
