const text=(tag,value,cls)=>{const e=document.createElement(tag);e.textContent=value;if(cls)e.className=cls;return e;};
export async function mountStaffDirectory(root,{repo,projectId,projectName,institutional=false}){
 root.replaceChildren();
 const intro=text('section','','panel');intro.append(text('p','PERSONAS · ADPHOR','eyebrow'),text('h1',institutional?'Equipo institucional':'Equipo administrativo'),text('p',institutional?'ADPHOR':projectName||projectId,'muted'));
 const status=text('p','Consultando el equipo autorizado…','muted');status.setAttribute('role','status');intro.append(status);root.append(intro);
 try{
  const people=await (institutional?repo.institutionalStaff():repo.staffDirectory(projectId));
  if(!intro.isConnected)return;
  status.textContent=institutional?`${people.length} integrantes autorizados.`:people.length?`${people.length} personas vinculadas a esta copropiedad.`:'No hay personas vinculadas a esta copropiedad.';
  const carousel=document.createElement('div');carousel.className='staff-directory-carousel';carousel.setAttribute('role','list');carousel.setAttribute('aria-label',institutional?'Equipo institucional':'Equipo de la copropiedad');
  if(institutional){
   carousel.tabIndex=0;
   const controls=document.createElement('div');
   const department=document.createElement('select');department.setAttribute('aria-label','Departamento');
   department.append(new Option('Todos los departamentos',''));
   for(const value of [...new Set(people.map(p=>p.department))].sort())department.append(new Option(value,value));
   const search=document.createElement('input');search.type='search';search.placeholder='Nombre o cargo';search.setAttribute('aria-label','Buscar por nombre o cargo');
   const normalize=value=>value.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().trim();
   const filter=()=>{
    let visible=0;
    for(const card of carousel.children){
     card.hidden=Boolean(department.value&&card.dataset.department!==department.value)||!normalize(card.dataset.search).includes(normalize(search.value));
     if(!card.hidden)visible++;
    }
    status.textContent=visible?`${visible} de ${people.length} integrantes autorizados.`:'No hay integrantes para este filtro.';
    carousel.scrollLeft=0;
   };
   department.addEventListener('change',filter);search.addEventListener('input',filter);
   controls.append(department,search);
   for(const [label,direction] of [['Anterior',-1],['Siguiente',1]]){
    const button=text('button',label);button.type='button';
    button.onclick=()=>carousel.scrollBy({left:direction*carousel.clientWidth,behavior:'smooth'});
    controls.append(button);
   }
   intro.append(controls);
  }
  for(const person of people){
   const card=document.createElement('article');card.className='panel staff-directory-card';card.setAttribute('role','listitem');
   if(institutional){card.dataset.department=person.department;card.dataset.search=`${person.name} ${person.role_label}`;}
   const initials=String(person.name).trim().split(/\s+/).slice(0,2).map(s=>s[0]).join('');
   const fallback=text('span',initials,'avatar staff-directory-portrait');fallback.setAttribute('aria-hidden','true');card.append(fallback);
   if(person.photo_path){
    const image=document.createElement('img');image.alt=`Fotografía de ${person.name}`;image.width=144;image.height=144;image.className='staff-directory-portrait';
    (institutional?repo.institutionalStaffPhoto(person.photo_path):repo.staffPhotoUrl(projectId,person.id)).then(url=>{
     if(!card.isConnected)return;
     image.onload=()=>fallback.replaceWith(image);
     image.src=url;
    }).catch(()=>{});
   }
   card.append(text('h2',person.name),text('p',person.role_label,'staff-directory-role'));
   if(institutional)card.append(text('p',person.department),text('p','Activo','muted'));
   else card.append(text('p',({delegate:'Administración de esta copropiedad',coordinator:'Coordinación asignada',support:'Apoyo administrativo'})[person.relationship]||'Equipo asignado','muted'));
   if(person.functions?.length){const list=document.createElement('ul');for(const f of person.functions)list.append(text('li',f));card.append(list);}
   else card.append(text('p','Funciones específicas pendientes de registrar.','muted'));
   carousel.append(card);
  }
  root.append(carousel);
 }catch(error){if(intro.isConnected){status.textContent='No se pudo cargar el equipo. Actualiza la vista o contacta al administrador.';status.setAttribute('role','alert');}}
}
