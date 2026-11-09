// The repository supplies only approved, tenant-scoped staff. No source URLs.
export function drawCompanionOptions(host,people,{photoUrl}={}){
 const fragment=document.createDocumentFragment();
 for(const [index,person] of [{id:'',nombre:'Sin acompañamiento requerido',leyendaRol:''},...people].entries()){
  const label=document.createElement('label');label.className='meeting-escort-card';
  const radio=document.createElement('input');radio.type='radio';radio.name='escort_id';radio.value=person.id;radio.checked=index===0;
  const name=document.createElement('strong');name.textContent=person.nombre;
  label.append(radio,name);
  if(person.leyendaRol){const role=document.createElement('small');role.textContent=person.leyendaRol;label.append(role);}
  if(person.photoStoragePath&&photoUrl){
   const image=document.createElement('img');image.alt='Fotografía de '+person.nombre;image.width=92;image.height=92;image.loading='lazy';label.prepend(image);
   Promise.resolve().then(()=>photoUrl(person.id)).then(url=>{if(label.isConnected)image.src=url;}).catch(()=>image.remove());
  }
  fragment.append(label);
 }
 host.replaceChildren(fragment);
}
