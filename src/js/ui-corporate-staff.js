// Institutional roster. No credentials, private identifiers or photo URLs are embedded.
const make = (tag, value='', className='') => {
  const el=document.createElement(tag);
  el.textContent=String(value ?? '');
  if(className) el.className=className;
  return el;
};
const normalize = value => String(value ?? '').normalize('NFD')
  .replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es').trim();
const initials = name => String(name ?? '').trim().split(/\s+/).slice(0,2)
  .map(chunk=>chunk[0]||'').join('').toUpperCase();
const portrait = (card, person, repo, alive) => {
  const placeholder=make('span',initials(person.name),'staff-company-portrait staff-company-placeholder');
  placeholder.setAttribute('aria-hidden','true');
  card.append(placeholder);
  if(!person.photo_path || typeof repo.corporateStaffPhoto!=='function')return;
  const img=document.createElement('img');
  img.className='staff-company-portrait';
  img.alt='Fotografía de '+person.name;
  img.width=128; img.height=128; img.loading='lazy';
  repo.corporateStaffPhoto(person.photo_path).then(url=>{
    if(!alive() || !card.isConnected)return;
    img.onload=()=>{if(alive() && card.isConnected)placeholder.replaceWith(img);};
    img.onerror=()=>{img.remove();};
    img.src=url;
  }).catch(()=>{});
};

export async function mountCorporateStaff(root,{repo}) {
  const generation=Symbol('corporate-roster');
  root.__corporateStaffGeneration=generation;
  const alive=()=>root.isConnected && root.__corporateStaffGeneration===generation;
  root.replaceChildren();

  const header=make('section','','panel staff-company-header');
  header.append(make('p','ADPHOR · DIRECTORIO INSTITUCIONAL','eyebrow'),
    make('h1','Equipo corporativo ADPHOR'),
    make('p','Conoce los colaboradores de ADPHOR, sus cargos y las copropiedades asignadas.','muted'));
  const status=make('p','Cargando directorio autorizado…','muted');
  status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  const error=make('p','','staff-company-error');
  error.setAttribute('role','alert');error.hidden=true;
  header.append(status,error);root.append(header);

  let people=[],canManage=false;
  try {
    people=await repo.corporateStaffDirectory();
    if(!alive())return;
    if(!Array.isArray(people))throw new Error('Directorio inválido.');
    // A failed capability lookup never gives write privileges in the browser.
    canManage=await repo.corporateStaffCanManage().catch(()=>false);
  } catch {
    if(alive()){status.textContent='No se pudo cargar el directorio corporativo.';error.hidden=false;
      error.textContent='Verifica tu sesión y MFA, o solicita asistencia a un administrador autorizado.';}
    return;
  }
  if(!alive())return;
  const controls=make('div','','staff-company-controls');
  const search=document.createElement('input');
  search.type='search';search.placeholder='Buscar por nombre o cargo';
  search.setAttribute('aria-label','Buscar por nombre o cargo');
  const department=document.createElement('select');
  department.setAttribute('aria-label','Filtrar por área');
  department.append(new Option('Todas las áreas',''));
  for(const name of [...new Set(people.map(person=>person.department||'Otras áreas'))].sort((a,b)=>a.localeCompare(b,'es')))
    department.append(new Option(name,name));
  controls.append(search,department);

  const carousel=make('div','','staff-company-carousel');
  carousel.setAttribute('role','list');carousel.setAttribute('aria-label','Equipo corporativo completo');
  carousel.tabIndex=0;
  const buttons=make('div','','staff-company-arrows');
  for(const [label,dir] of [['Anterior',-1],['Siguiente',1]]) {
    const button=make('button',label,'btn secondary');
    button.type='button';button.setAttribute('aria-label',label+' colaboradores');
    button.addEventListener('click',()=>carousel.scrollBy({left:dir*Math.max(240,carousel.clientWidth*.8),behavior:'smooth'}));
    buttons.append(button);
  }
  controls.append(buttons);
  header.append(controls);
  const collection=make('section','','staff-company-section');
  collection.append(carousel);root.append(collection);

  const cards=[];
  const refresh=()=>{
    const query=normalize(search.value);
    const group=department.value;
    let shown=0,visible=0;
    for(const {person,card} of cards) {
      const hit=(!group || (person.department||'Otras áreas')===group)
        && normalize(person.name+' '+person.role_label).includes(query);
      card.hidden=!hit;
      if(hit)shown++;
      if(person.carousel_visible)visible++;
    }
    status.textContent=shown+' de '+people.length+' colaboradores en el filtro · '
      +visible+' visibles en el carrusel';
  };

  for(const person of people) {
    const card=make('article','','panel staff-company-card');
    card.setAttribute('role','listitem');
    if(person.carousel_visible===false)card.classList.add('is-hidden-from-roster');
    portrait(card,person,repo,alive);
    card.append(make('h2',person.name),make('p',person.role_label,'staff-company-role'),
      make('p',person.department||'Otras áreas','staff-company-department'));
    const count=Number(person.assigned_properties)||0;
    card.append(make('p',count===0?'Sin copropiedad asignada':
      count===1?'1 copropiedad asignada':count+' copropiedades asignadas','muted'));
    if(Array.isArray(person.functions) && person.functions.length) {
      const list=make('ul','','staff-company-functions');
      for(const functionText of person.functions)list.append(make('li',functionText));
      card.append(list);
    } else card.append(make('p','Funciones específicas pendientes de documentar.','muted'));
    if(canManage) {
      const visibility=make('p','','staff-company-visibility');
      const button=make('button','','btn secondary staff-company-toggle');
      button.type='button';
      const paint=()=>{
        const shown=person.carousel_visible!==false;
        visibility.textContent=shown?'Visible en el carrusel':'Oculto del carrusel';
        button.textContent=shown?'Ocultar del carrusel':'Mostrar en el carrusel';
        button.setAttribute('aria-label',(shown?'Ocultar':'Mostrar')+' del carrusel a '+person.name);
        button.setAttribute('aria-pressed',String(shown));
        card.classList.toggle('is-hidden-from-roster',!shown);
      };
      paint();
      button.addEventListener('click',async()=>{
        if(button.disabled || !alive())return;
        const next=person.carousel_visible===false;
        button.disabled=true;error.hidden=true;
        try {
          const confirmed=await repo.corporateStaffSetVisible(person.id,next);
          if(!alive())return;
          if(confirmed!==next)throw new Error('Cambio no confirmado.');
          person.carousel_visible=next;
          paint();refresh();
          status.textContent+=' · Cambio guardado.';
        }catch{
          if(alive()){error.hidden=false;error.textContent=
            'No se guardó el cambio de visibilidad. Conservamos el estado anterior.';}
        }finally{if(alive())button.disabled=false;}
      });
      card.append(visibility,button);
    }
    cards.push({person,card});carousel.append(card);
  }
  const noMatch=make('p','Ningún colaborador coincide con estos filtros.','muted');
  noMatch.hidden=true;collection.append(noMatch);
  const filter=()=>{refresh();noMatch.hidden=cards.some(({card})=>!card.hidden);carousel.scrollLeft=0;};
  search.addEventListener('input',filter);
  department.addEventListener('change',filter);
  filter();

  if(canManage && typeof repo.corporateStaffHistory==='function') {
    const details=make('details','','staff-company-history');
    const summary=make('summary','Historial de cambios de visibilidad');
    const history=make('div','Abre el historial para consultar los cambios recientes.','muted');
    details.append(summary,history);root.append(details);
    let loaded=false;
    details.addEventListener('toggle',async()=>{
      if(!details.open || loaded || !alive())return;
      loaded=true;
      history.textContent='Consultando el historial…';
      try{
        const rows=await repo.corporateStaffHistory();
        if(!alive())return;
        history.replaceChildren();
        if(!rows.length){history.append(make('p','Aún no se han realizado cambios.','muted'));return;}
        const list=make('ol','','staff-company-audit-list');
        for(const row of rows){
          const date=new Date(row.changed_at);
          const stamp=Number.isNaN(date.getTime())?'Fecha no disponible':
            new Intl.DateTimeFormat('es-CO',{dateStyle:'medium',timeStyle:'short',timeZone:'America/Bogota'}).format(date);
          list.append(make('li',row.staff_name+' · '+
            (row.visible_after?'Activado':'Ocultado')+' · '+stamp));
        }
        history.append(list);
      }catch{
        if(alive()){loaded=false;history.textContent='No se pudo consultar el historial. Vuelve a abrirlo.';}
      }
    });
  }
}
