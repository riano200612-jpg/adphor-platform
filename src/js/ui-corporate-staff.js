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
const photoFileMatches = (person,file) => {
  if(!file || !/^delegate-[0-9]+$/.test(person.id)||person.name.trim().length<3)return false;
  const id=person.id.slice('delegate-'.length);
  const name=normalize(file.name||'').replace(/\.(jpg|jpeg|png|webp)$/i,'');
  const match=name.match(/^([0-9]+)[.\s_-]+(.+)$/);
  if(!match || String(Number(match[1]))!==String(Number(id)))return false;
  const parts=normalize(person.name).split(/[^a-z0-9]+/).filter(x=>x.length>=3);
  const source=match[2].split(/[^a-z0-9]+/).filter(x=>x.length>=3);
  return source.some(x=>parts.includes(x));
};

/**
 * Prepare an auditable, collision-free selection. Never infer identities from
 * a face or a loose filename, and never replace an existing staff portrait.
 * The Supabase service still checks actual image bytes, AAL2 and admin rights.
 */
export function planCorporatePhotoBatch(people,files) {
  const selected=[],rejected=[];
  const input=Array.from(files||[]);
  if(input.length>20)return {selected,rejected:[{name:'Selección',reason:'Selecciona 20 imágenes o menos por lote.'}]};
  const known=new Map((Array.isArray(people)?people:[]).map(p=>[p.id,p]));
  const seen=new Set();
  for(const file of input) {
    const name=String(file?.name||'');
    const match=name.match(/^0*([0-9]{1,3})[.\s_-]+.+\.(jpg|jpeg|png|webp)$/i);
    if(!match){rejected.push({name,reason:'Archivo sin número de colaborador y extensión reconocida.'});continue;}
    const id='delegate-'+String(Number(match[1]));
    const person=known.get(id);
    if(!person||!person.name?.trim()||person.name.trim().length<3){
      rejected.push({name,reason:'Colaborador no identificado en el directorio autorizado.'});continue;
    }
    if(person.photo_path){
      rejected.push({name,reason:'Esta persona ya tiene una fotografía; se conserva.'});continue;
    }
    if(seen.has(id)){
      rejected.push({name,reason:'Hay otro archivo seleccionado para esta persona.'});continue;
    }
    const mimeExtension={jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp'};
    const ext=match[2].toLowerCase();
    if(file?.type!==mimeExtension[ext]||!Number.isFinite(file?.size)
      ||file.size<12||file.size>10485760){
      rejected.push({name,reason:'Formato o tamaño de imagen inválido (máximo 10 MB).'});continue;
    }
    if(!photoFileMatches(person,file)){
      rejected.push({name,reason:'El número o nombre del archivo no concuerda con la ficha.'});continue;
    }
    seen.add(id);
    selected.push({person,file,name});
  }
  return {selected,rejected};
}

const portrait = (card, person, repo, alive) => {
  // Lazy images must be attached to the document before the browser will fetch them.
  // Keep initials underneath until the private signed image is fully decoded.
  const frame=make('span','','staff-company-photo-frame');
  const placeholder=make('span',initials(person.name),'staff-company-portrait staff-company-placeholder');
  placeholder.setAttribute('aria-hidden','true');
  frame.append(placeholder);
  card.prepend(frame);
  if(!person.photo_path || typeof repo.corporateStaffPhoto!=='function')return;
  const img=document.createElement('img');
  img.className='staff-company-portrait staff-company-photo';
  img.alt='Fotografía de '+person.name;
  img.width=128; img.height=128; img.loading='lazy';
  img.onload=()=>{
    if(!alive() || !card.isConnected)return;
    placeholder.remove();
    img.classList.add('is-loaded');
  };
  img.onerror=()=>{img.remove();};
  repo.corporateStaffPhoto(person.photo_path).then(url=>{
    if(!alive() || !card.isConnected)return;
    // Append first: a detached lazy <img> can never reach its onload callback.
    frame.append(img);
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
    // Copy one verified source photo into private QA storage; never alter Drive originals.
    if(canManage && !person.photo_path && typeof repo.corporateStaffUploadPhoto==='function'
      && person.name.trim().length>=3) {
      const uploader=make('div','','staff-company-upload');
      const label=make('label','Fotografía pendiente · selecciona el archivo '+
        person.id.slice('delegate-'.length)+' de José:','staff-company-upload-label');
      const field=document.createElement('input');
      field.type='file';field.accept='image/jpeg,image/png,image/webp';
      field.setAttribute('aria-label','Seleccionar fotografía de '+person.name);
      label.append(field);
      const save=make('button','Guardar fotografía','btn secondary');
      save.type='button';save.disabled=true;
      const feedback=make('p','','staff-company-upload-feedback');
      feedback.setAttribute('role','status');feedback.setAttribute('aria-live','polite');
      field.addEventListener('change',()=>{
        const selected=field.files?.[0];
        const correct=photoFileMatches(person,selected);
        save.disabled=!correct;
        feedback.textContent=!selected?'':correct
          ?'Archivo '+selected.name+' listo para asociar a '+person.name+'.'
          :'El número del archivo o nombre no coincide con este colaborador. No se cargó.';
      });
      save.addEventListener('click',async()=>{
        const selected=field.files?.[0];
        if(save.disabled || !alive() || !photoFileMatches(person,selected))return;
        save.disabled=true;field.disabled=true;
        feedback.textContent='Importando fotografía de forma privada…';
        try{
          const path=await repo.corporateStaffUploadPhoto(person.id,selected);
          if(!alive())return;
          if(typeof path!=='string'||!path.startsWith(person.id+'/'))
            throw new Error('No se confirmó la asociación de la fotografía.');
          person.photo_path=path;
          card.querySelector('.staff-company-photo-frame')?.remove();
          portrait(card,person,repo,alive);
          uploader.remove();
          status.textContent='Fotografía guardada para '+person.name+' · '+people.length+' colaboradores.';
        }catch(e){
          if(alive())feedback.textContent=(e?.message||'No se pudo importar la fotografía.')+
            ' No se modificó la ficha del colaborador.';
        }finally{
          if(alive()){field.disabled=false;save.disabled=!photoFileMatches(person,field.files?.[0]);}
        }
      });
      uploader.append(label,save,feedback);card.append(uploader);
    }
    cards.push({person,card});carousel.append(card);
  }

  // Only a verified corporate admin can see this helper, while the server
  // rechecks authorization, AAL2, file bytes, and immutable storage for EACH file.
  if(canManage && typeof repo.corporateStaffUploadPhoto==='function'){
    const batch=make('section','','staff-company-batch');
    batch.append(make('h2','Importación múltiple de fotografías'));
    const instructions=make('p','Extrae primero el ZIP original de José. Selecciona hasta 20 imágenes y verifica las asociaciones antes de guardar. No se reemplazarán fotos existentes.','muted');
    const label=make('label','Seleccionar fotografías corporativas pendientes','staff-company-batch-label');
    const picker=document.createElement('input');
    picker.type='file';picker.multiple=true;picker.accept='image/jpeg,image/png,image/webp';
    picker.setAttribute('aria-label','Seleccionar múltiples fotografías corporativas');
    label.append(picker);
    const preview=make('div','','staff-company-batch-preview');
    preview.setAttribute('role','status');preview.setAttribute('aria-live','polite');
    const save=make('button','Importar fotografías verificadas','btn secondary');
    save.type='button';save.disabled=true;
    let plan={selected:[],rejected:[]},busy=false;
    const display=()=>{
      if(busy)return;
      plan=planCorporatePhotoBatch(people,picker.files);
      preview.replaceChildren();
      preview.append(make('p',String(plan.selected.length)+' fotos preparadas · '+String(plan.rejected.length)+' descartadas'));
      const list=make('ul','','staff-company-batch-review');
      for(const {person,name} of plan.selected)
        list.append(make('li',name+' → '+person.name));
      for(const item of plan.rejected)
        list.append(make('li',item.name+' — NO IMPORTAR: '+item.reason));
      preview.append(list);
      save.disabled=plan.selected.length===0;
      save.textContent=plan.selected.length
        ?'Importar '+String(plan.selected.length)+' fotografías verificadas'
        :'Importar fotografías verificadas';
    };
    picker.addEventListener('change',display);
    save.addEventListener('click',async()=>{
      if(busy || !plan.selected.length || !alive())return;
      busy=true;picker.disabled=true;save.disabled=true;
      const toUpload=[...plan.selected];
      let count=0,failed=null;
      for(const {person,file} of toUpload){
        if(!alive())break;
        preview.replaceChildren(make('p','Importando '+String(count+1)+' de '+String(toUpload.length)+': '+person.name));
        try {
          const path=await repo.corporateStaffUploadPhoto(person.id,file);
          if(typeof path!=='string' || !path.startsWith(person.id+'/'))
            throw Error('La asociación privada no fue confirmada.');
          person.photo_path=path;count++;
          if(!alive())break;
          const entry=cards.find(({person:p})=>p.id===person.id);
          if(entry){
            entry.card.querySelector('.staff-company-photo-frame')?.remove();
            portrait(entry.card,person,repo,alive);
            entry.card.querySelector('.staff-company-upload')?.remove();
          }
        }catch(e){
          failed={person:person.name,reason:e?.message||'No se pudo guardar esta fotografía.'};
          break; // Stop safely; never continue after an MFA/network error.
        }
      }
      if(alive()){
        busy=false;picker.disabled=false;
        picker.value='';
        plan={selected:[],rejected:[]};
        save.disabled=true;save.textContent='Importar fotografías verificadas';
        const summary=count+' de '+toUpload.length+' fotografías confirmadas en almacenamiento privado.';
        preview.replaceChildren(make('p',summary+(failed?' Proceso detenido en '+failed.person+': '+failed.reason:'')));
        refresh();
      }
    });
    batch.append(instructions,label,preview,save);
    header.append(batch);
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
