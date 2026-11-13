import {validateQaEvidence} from './services/qa-evidence-policy.js';

// All content from Supabase is text-only. Signed links are requested explicitly,
// expire after 90 seconds and are never persisted in the browser.
export function mountVisitEvidence(root,{row,evidence,canWrite=false}){
 if(!evidence||typeof evidence.listEvidence!=='function'||typeof evidence.signedEvidence!=='function')
  throw Error('Proveedor de evidencias de Visitas no disponible.');
 const projectId=row.project_id,requestId=row.request_id;
 const section=document.createElement('section');
 section.className='visit-evidence';
 const title=document.createElement('h4');title.textContent='Evidencias privadas de la visita';
 const guidance=document.createElement('p');guidance.className='muted';
 guidance.textContent='Acceso por copropiedad y MFA AAL2. Cada enlace privado caduca después de 90 segundos.';
 const message=document.createElement('p');message.setAttribute('role','status');
 const readButton=document.createElement('button');readButton.type='button';
 readButton.textContent='Consultar evidencias de la visita';
 const list=document.createElement('ol');list.dataset.visitEvidenceList='';
 let reading=false;
 async function refresh(){
  if(reading)return;
  reading=true;readButton.disabled=true;message.textContent='Consultando archivos autorizados…';
  try{
   const rows=await evidence.listEvidence(projectId,requestId);
   if(!section.isConnected)return;
   if(!Array.isArray(rows)||rows.length>50||rows.some(x=>x.project_id!==projectId||x.request_id!==requestId))
    throw Error('No se pudo verificar el historial de archivos.');
   list.replaceChildren();
   for(const record of rows){
    const item=document.createElement('li');
    const info=document.createElement('span');
    info.textContent=(record.media_type||'Archivo')+' · '+(Number(record.file_bytes)/1048576).toFixed(2)+' MB · '+(record.created_at||'Sin fecha');
    item.append(info);
    const linkButton=document.createElement('button');linkButton.type='button';
    linkButton.textContent='Preparar enlace privado';
    let signedBusy=false;
    linkButton.addEventListener('click',async()=>{
     if(signedBusy)return;
     signedBusy=true;linkButton.disabled=true;
     try{
      const url=await evidence.signedEvidence(projectId,requestId,record.id);
      if(!item.isConnected)return;
      item.querySelector('a[data-visit-signed]')?.remove();
      const anchor=document.createElement('a');
      anchor.dataset.visitSigned='';
      anchor.textContent='Abrir archivo (90 segundos)';
      anchor.href=url;anchor.target='_blank';anchor.rel='noopener noreferrer';
      item.append(anchor);
     }catch{
      if(item.isConnected)message.textContent='No se pudo preparar el enlace privado; comprueba permisos.';
     }finally{signedBusy=false;if(linkButton.isConnected)linkButton.disabled=false;}
    });
    item.append(linkButton);list.append(item);
   }
   if(!rows.length){const empty=document.createElement('li');empty.textContent='Esta visita aún no tiene evidencias.';list.append(empty);}
   message.textContent=rows.length+' archivo(s) privado(s) asociado(s) a esta visita.';
  }catch{
   if(section.isConnected)message.textContent='No se pudieron verificar las evidencias privadas; inténtalo nuevamente.';
  }finally{reading=false;if(readButton.isConnected)readButton.disabled=false;}
 }
 readButton.addEventListener('click',refresh);
 section.append(title,guidance,readButton,message,list);
 // Final states are immutable: existing private evidence remains readable,
 // but neither the UI nor the SQL policies permit new files after closure.
 if(canWrite && ['programada','en_ejecucion'].includes(row.status) && typeof evidence.uploadEvidence==='function'){
  const label=document.createElement('label');
  label.textContent='Adjuntar fotos, videos o PDF (máximo cinco, 20 MB cada uno)';
  const fileInput=document.createElement('input');fileInput.type='file';fileInput.multiple=true;
  fileInput.accept='image/jpeg,image/png,image/webp,video/mp4,video/webm,application/pdf';
  const uploadButton=document.createElement('button');uploadButton.type='button';
  uploadButton.textContent='Guardar evidencias privadas';
  label.append(fileInput);section.append(label,uploadButton);
  let sending=false;
  uploadButton.addEventListener('click',async()=>{
   if(sending)return;
   let files;
   try{files=validateQaEvidence(fileInput.files);if(!files.length)throw Error('Selecciona algún archivo.');}
   catch(error){message.textContent=error.message;return;}
   sending=true;uploadButton.disabled=true;fileInput.disabled=true;
   message.textContent='Guardando archivos en almacenamiento privado…';
   try{
    const confirmed=await evidence.uploadEvidence({projectId,requestId,files});
    if(!section.isConnected)return;
    if(!Array.isArray(confirmed)||confirmed.length!==files.length||confirmed.some(x=>x.project_id!==projectId||x.request_id!==requestId||!x.storage_written||!x.metadata_linked))
     throw Error('La evidencia no quedó confirmada.');
    fileInput.value='';
    await refresh();
   }catch{
    if(section.isConnected)message.textContent='No se confirmó la asociación de todos los archivos. Reintenta con los mismos archivos; no se duplicará la visita.';
   }finally{sending=false;if(uploadButton.isConnected)uploadButton.disabled=false;if(fileInput.isConnected)fileInput.disabled=false;}
  });
 }
 root.append(section);
 return section;
}
