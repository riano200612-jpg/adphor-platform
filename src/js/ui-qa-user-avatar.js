import {validateAvatarInput,validateWebpAvatar} from './services/qa-account-avatar.js';

export async function prepareAccountAvatar(file){
  validateAvatarInput(file);
  if(typeof createImageBitmap!=='function')throw Error('Este navegador no puede preparar la fotografía.');
  let image;
  try{
    image=await createImageBitmap(file);
    if(!image.width||!image.height||image.width>12000||image.height>12000)
      throw Error('Las dimensiones de la fotografía no son válidas.');
    const canvas=document.createElement('canvas');
    canvas.width=320;canvas.height=320;
    const ctx=canvas.getContext('2d');
    if(!ctx)throw Error('No se pudo procesar la fotografía.');
    const side=Math.min(image.width,image.height);
    ctx.drawImage(image,(image.width-side)/2,(image.height-side)/2,side,side,0,0,320,320);
    const result=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',.84));
    validateWebpAvatar(result);
    return result;
  }finally{image?.close?.();}
}
function node(doc,tag,cls,value=''){
  const n=doc.createElement(tag);if(cls)n.className=cls;if(value)n.textContent=value;
  return n;
}
export function mountQaAccountAvatar(host,{store,userId,makeUrl=blob=>URL.createObjectURL(blob),revokeUrl=url=>URL.revokeObjectURL(url)}={}){
  if(!host||!store||!userId||
    typeof store.read!=='function'||typeof store.upload!=='function'||typeof store.remove!=='function')
    return ()=>{};
  const previous=host.querySelector('.avatar');
  if(!previous||host.querySelector('.qa-avatar-trigger'))return ()=>{};
  const doc=host.ownerDocument;
  const fallback=String(previous.textContent||'').trim().slice(0,4)||'?';
  const button=node(doc,'button','avatar qa-avatar-trigger',fallback);
  button.type='button';
  button.title='Mi fotografía de perfil';
  button.dataset.photoState='loading';
  button.setAttribute('aria-label','Foto de mi perfil. Abrir opciones');
  const panel=node(doc,'section','qa-avatar-panel');
  panel.hidden=true;
  // Stable enough for this ephemeral topbar, no content from the account in DOM IDs.
  const menuId='qa-avatar-panel-'+Math.random().toString(36).slice(2,10);
  panel.id=menuId;
  panel.setAttribute('aria-label','Opciones de fotografía personal');
  button.setAttribute('aria-controls',menuId);
  button.setAttribute('aria-expanded','false');
  const title=node(doc,'strong','qa-avatar-title','Mi fotografía');
  const hint=node(doc,'p','qa-avatar-hint','Tu foto aparecerá aquí cada vez que ingreses. Solo tu cuenta puede verla y cambiarla. Selecciona una foto para reemplazar tus iniciales.');
  const input=node(doc,'input','qa-avatar-file');
  input.type='file';input.accept='image/jpeg,image/png,image/webp';input.hidden=true;
  input.setAttribute('aria-label','Seleccionar fotografía de perfil');
  const actions=node(doc,'div','qa-avatar-actions');
  const upload=node(doc,'button','qa-avatar-action','Subir o cambiar foto');
  upload.type='button';
  const remove=node(doc,'button','qa-avatar-action qa-avatar-remove','Quitar foto');
  remove.type='button';remove.disabled=true;
  const close=node(doc,'button','qa-avatar-close','Cerrar');
  close.type='button';
  const status=node(doc,'p','qa-avatar-status');
  status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  actions.append(upload,remove,close);
  panel.append(title,hint,input,actions,status);
  previous.replaceWith(button);
  host.append(panel);host.classList.add('qa-avatar-host');
  let disposed=false,busy=false,hasPhoto=false,objectUrl=null,request=0;
  function release(){if(objectUrl){revokeUrl(objectUrl);objectUrl=null;}}
  function fallbackView(){
    release();hasPhoto=false;button.replaceChildren(doc.createTextNode(fallback));
    button.dataset.photoState='empty';button.title='Agregar mi foto de perfil';
    remove.disabled=true;
  }
  function showStaffPreview(url){
    if(typeof url!=='string'||!/^https:\/\//.test(url)){fallbackView();return;}
    release();
    const img=node(doc,'img','qa-avatar-photo');
    img.alt='';img.decoding='async';img.referrerPolicy='no-referrer';img.src=url;
    img.onerror=()=>{
      if(!disposed&&!hasPhoto && button.dataset.photoState==='corporate'){
        fallbackView();
        status.textContent='No fue posible mostrar la foto corporativa.';
      }
    };
    button.replaceChildren(img);hasPhoto=false;remove.disabled=true;
    button.dataset.photoState='corporate';
    button.title='Foto corporativa. Agregar mi fotografía personal';
  }
  function showPhoto(blob){
    if(!blob||blob.type!=='image/webp'){fallbackView();return;}
    const url=makeUrl(blob);
    const img=node(doc,'img','qa-avatar-photo');
    img.alt='';img.decoding='async';img.src=url;
    img.onerror=()=>{
      if(!disposed&&objectUrl===url){
        fallbackView();status.textContent='La foto no se pudo visualizar; puedes cargarla nuevamente.';
      }
    };
    release();objectUrl=url;hasPhoto=true;button.replaceChildren(img);
    button.dataset.photoState='ready';button.title='Ver o cambiar mi foto de perfil';
    remove.disabled=false;
  }
  async function refresh(){
    const version=++request;
    try{
      const file=await store.read(userId);
      if(disposed||!button.isConnected||version!==request)return;
      if(file){
        showPhoto(file);
        status.textContent='Foto de perfil cargada. Se mostrará en tus próximos ingresos.';
        return;
      }
      // No personal file: show only the staff photo bound server-side to this account.
      const staffUrl=typeof store.staffPreview==='function'
        ?await store.staffPreview(userId).catch(()=>null):null;
      if(disposed||!button.isConnected||version!==request)return;
      if(staffUrl){
        showStaffPreview(staffUrl);
        status.textContent='Se muestra tu foto corporativa. Puedes reemplazarla con una personal.';
        return;
      }
      fallbackView();
      status.textContent='Aún no tienes foto guardada. Pulsa «Subir o cambiar foto» para personalizar tu cuenta.';
    }catch{
      if(disposed||version!==request)return;
      fallbackView();status.textContent='No se pudo consultar la foto. Se muestran tus iniciales.';
    }
  }
  const toggle=open=>{
    panel.hidden=!open;button.setAttribute('aria-expanded',String(open));
    (open?upload:button).focus();
  };
  button.addEventListener('click',()=>toggle(panel.hidden));
  close.addEventListener('click',()=>toggle(false));
  panel.addEventListener('keydown',event=>{
    if(event.key==='Escape'){event.preventDefault();toggle(false);}
  });
  upload.addEventListener('click',()=>{if(!busy)input.click();});
  input.addEventListener('change',async()=>{
    const file=input.files?.[0];input.value='';
    if(!file||busy)return;
    busy=true;upload.disabled=true;remove.disabled=true;
    try{
      status.textContent='Preparando tu fotografía…';
      const webp=await prepareAccountAvatar(file);
      status.textContent='Guardando en el depósito privado…';
      await store.upload(userId,webp);
      if(disposed)return;
      await refresh();
      if(hasPhoto)status.textContent='Tu foto se actualizó correctamente.';
    }catch(error){
      if(!disposed)status.textContent=error?.message||'No se pudo actualizar la foto.';
    }finally{
      busy=false;if(!disposed){upload.disabled=false;remove.disabled=!hasPhoto;}
    }
  });
  remove.addEventListener('click',async()=>{
    if(busy||!hasPhoto)return;
    busy=true;upload.disabled=true;remove.disabled=true;
    try{
      await store.remove(userId);
      if(disposed)return;
      ++request;fallbackView();await refresh();
      status.textContent=button.dataset.photoState==='corporate'
        ?'Foto personal retirada. Se muestra nuevamente tu foto corporativa.'
        :'Foto retirada. Se muestran tus iniciales.';
    }catch(error){
      if(!disposed)status.textContent=error?.message||'No se pudo quitar la foto.';
    }finally{
      busy=false;if(!disposed){upload.disabled=false;remove.disabled=!hasPhoto;}
    }
  });
  // The avatar always remains a self-service control; no unsolicited modal is shown.
  void refresh();
  return ()=>{
    disposed=true;++request;release();panel.remove();
    host.classList.remove('qa-avatar-host');
  };
}
