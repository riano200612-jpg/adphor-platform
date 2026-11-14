import {validateQaVisitEvidence} from './services/qa-visit-evidence-policy.js';

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
 const moreButton=document.createElement('button');
 moreButton.type='button';moreButton.textContent='Mostrar más evidencias privadas';
 moreButton.dataset.visitEvidenceMore='';moreButton.hidden=true;
 let loadedCount=0;
 async function refresh(append=false){
  if(reading)return;
  reading=true;readButton.disabled=true;moreButton.disabled=true;
  message.textContent='Consultando archivos autorizados…';
  try{
   const paginated=typeof evidence.listEvidencePage==='function';
   const page=paginated
    ? await evidence.listEvidencePage(projectId,requestId,append?loadedCount:0)
    : {rows:await evidence.listEvidence(projectId,requestId),hasMore:false};
   if(!section.isConnected)return;
   const rows=page?.rows;
   if(!Array.isArray(rows)||rows.length>50||typeof page.hasMore!=='boolean'
    ||(page.hasMore&&rows.length!==50)
    ||rows.some(x=>x.project_id!==projectId||x.request_id!==requestId))
    throw Error('No se pudo verificar el historial de archivos.');
   if(!append){list.replaceChildren();loadedCount=0;}
   for(const record of rows){
    const item=document.createElement('li');
    const info=document.createElement('span');
    info.textContent=(record.file_name||'Archivo sin nombre registrado')+' · '+(record.media_type||'Archivo')+' · '+(Number(record.file_bytes)/1048576).toFixed(2)+' MB · '+(record.created_at||'Sin fecha');
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
   loadedCount+=rows.length;
   if(!loadedCount){const empty=document.createElement('li');empty.textContent='Esta visita aún no tiene evidencias.';list.append(empty);}
   moreButton.hidden=!page.hasMore;
   message.textContent=loadedCount+' archivo(s) privado(s) consultado(s) para esta visita.'+
    (page.hasMore?' Puedes consultar más evidencias.':'');
   return true;
  }catch{
   if(section.isConnected)message.textContent='No se pudieron verificar las evidencias privadas; inténtalo nuevamente.';
   return false;
  }finally{
   reading=false;
   if(readButton.isConnected)readButton.disabled=false;
   if(moreButton.isConnected)moreButton.disabled=false;
  }
 }
 readButton.addEventListener('click',()=>refresh(false));
 moreButton.addEventListener('click',()=>refresh(true));
 section.append(title,guidance,readButton,message,list,moreButton);
 // Final states are immutable: existing private evidence remains readable,
 // but neither the UI nor the SQL policies permit new files after closure.
 if(canWrite && ['programada','en_ejecucion'].includes(row.status) && typeof evidence.uploadEvidence==='function'){
  const label=document.createElement('label');
  label.textContent='Adjuntar fotos, videos, PDF, Word (.docx) o Excel (.xlsx) · máximo cinco, 20 MB cada uno';
  const fileInput=document.createElement('input');fileInput.type='file';fileInput.multiple=true;
  fileInput.accept='image/jpeg,image/png,image/webp,video/mp4,video/webm,application/pdf,.docx,.xlsx';
  const uploadButton=document.createElement('button');uploadButton.type='button';
  uploadButton.textContent='Guardar evidencias privadas';
  const selectionStatus=document.createElement('p');
  selectionStatus.dataset.visitSelectionStatus='';
  selectionStatus.setAttribute('role','status');
  const selectedList=document.createElement('ul');
  selectedList.dataset.visitSelectedFiles='';
  selectedList.setAttribute('aria-label','Archivos seleccionados para esta visita');
  let sending=false;
  function showSelectedFiles(){
   selectedList.replaceChildren();
   uploadButton.disabled=true;
   let files;
   try{files=validateQaVisitEvidence(fileInput.files);}
   catch(error){selectionStatus.textContent=error.message;return;}
   if(!files.length){
    selectionStatus.textContent='Selecciona imágenes o documentos permitidos antes de guardar.';
    return;
   }
   for(const file of files){
    const item=document.createElement('li');
    item.textContent=(file.name||'Archivo')+' · '+(file.size/1048576).toFixed(2)+' MB';
    selectedList.append(item);
   }
   selectionStatus.textContent=files.length+' archivo(s) listos para subir de forma privada.';
   uploadButton.disabled=sending;
  }
  label.append(fileInput);
  section.append(label,selectionStatus,selectedList,uploadButton);
  fileInput.addEventListener('change',showSelectedFiles);
  showSelectedFiles();
  uploadButton.addEventListener('click',async()=>{
   if(sending)return;
   let files;
   try{files=validateQaVisitEvidence(fileInput.files);if(!files.length)throw Error('Selecciona algún archivo.');}
   catch(error){message.textContent=error.message;return;}
   sending=true;uploadButton.disabled=true;fileInput.disabled=true;
   let progress=0;
   message.textContent='Guardando archivos en almacenamiento privado…';
   try{
    const confirmed=await evidence.uploadEvidence({projectId,requestId,files,onProgress:({completed,total})=>{
     if(Number.isInteger(completed)&&completed>progress&&completed<=total&&total===files.length){
      progress=completed;
      if(section.isConnected)message.textContent=completed+' de '+total+' archivo(s) confirmado(s) en almacenamiento privado y Visitas.';
     }
    }});
    if(!section.isConnected)return;
    if(!Array.isArray(confirmed)||confirmed.length!==files.length||confirmed.some(x=>x.project_id!==projectId||x.request_id!==requestId||!x.storage_written||!x.metadata_linked))
     throw Error('La evidencia no quedó confirmada.');
    fileInput.value='';
    showSelectedFiles();
    const refreshed=await refresh();
    if(section.isConnected)message.textContent=refreshed
     ? confirmed.length+' archivo(s) guardado(s) y asociado(s) a esta visita.'
     : confirmed.length+' archivo(s) guardado(s) correctamente. No se pudo actualizar el listado; pulsa «Consultar evidencias de la visita».';
   }catch{
    if(section.isConnected)message.textContent=progress>0&&progress<files.length
     ? 'Se confirmaron '+progress+' de '+files.length+' archivo(s). Reintenta los mismos archivos para completar la carga; los confirmados no se duplicarán.'
     : 'No se confirmó la asociación de todos los archivos. Reintenta con los mismos archivos; no se duplicará la visita.';
   }finally{sending=false;if(fileInput.isConnected)fileInput.disabled=false;if(uploadButton.isConnected)showSelectedFiles();}
  });
 }
 root.append(section);
 return section;
}
