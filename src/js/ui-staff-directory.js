const text=(tag,value,cls)=>{const e=document.createElement(tag);e.textContent=value;if(cls)e.className=cls;return e;};
export async function mountStaffDirectory(root,{repo,projectId,projectName}){
 root.replaceChildren();
 const intro=text('section','','panel');intro.append(text('p','PERSONAS · ADPHOR','eyebrow'),text('h1','Equipo administrativo'),text('p',projectName||projectId,'muted'));
 const status=text('p','Consultando el equipo autorizado…','muted');status.setAttribute('role','status');intro.append(status);root.append(intro);
 try{
  const people=await repo.staffDirectory(projectId);
  if(!intro.isConnected)return;
  status.textContent=people.length?`${people.length} personas vinculadas a esta copropiedad.`:'No hay personas vinculadas a esta copropiedad.';
  const carousel=document.createElement('div');carousel.className='staff-directory-carousel';carousel.setAttribute('role','list');carousel.setAttribute('aria-label','Equipo de la copropiedad');
  for(const person of people){
   const card=document.createElement('article');card.className='panel staff-directory-card';card.setAttribute('role','listitem');
   const initials=String(person.name).trim().split(/\s+/).slice(0,2).map(s=>s[0]).join('');
   const fallback=text('span',initials,'avatar staff-directory-portrait');fallback.setAttribute('aria-hidden','true');card.append(fallback);
   if(person.photo_path){
    const image=document.createElement('img');image.alt=`Fotografía de ${person.name}`;image.width=144;image.height=144;image.loading='lazy';image.className='staff-directory-portrait';
    repo.staffPhotoUrl(projectId,person.id).then(url=>{if(!card.isConnected)return;image.src=url;image.onload=()=>fallback.replaceWith(image);}).catch(()=>{});
   }
   card.append(text('h2',person.name),text('p',person.role_label,'staff-directory-role'));
   card.append(text('p',({delegate:'Administración de esta copropiedad',coordinator:'Coordinación asignada',support:'Apoyo administrativo'})[person.relationship]||'Equipo asignado','muted'));
   if(person.functions?.length){const list=document.createElement('ul');for(const f of person.functions)list.append(text('li',f));card.append(list);}
   else card.append(text('p','Funciones específicas pendientes de registrar.','muted'));
   carousel.append(card);
  }
  root.append(carousel);
 }catch(error){if(intro.isConnected){status.textContent='No se pudo cargar el equipo. Actualiza la vista o contacta al administrador.';status.setAttribute('role','alert');}}
}
