// QA Integral: private contributions only. No AI ingestion or Drive OAuth calls.
const el=(tag,text='',className='')=>{
 const node=document.createElement(tag);node.textContent=String(text);
 if(className)node.className=className;
 return node;
};
const label=(title,control)=>{const wrap=el('label');wrap.append(el('span',title),control);return wrap;};

export function mountMissDocumentIntake(root,{repo,projectId,projectName}={}){
 root.replaceChildren();
 const shell=el('section','','qa-miss-document-intake');
 const heading=el('header','','page-heading'),headingText=el('div');
 headingText.append(el('p','MISS ADPHOR · QA INTEGRAL','eyebrow'),
  el('h1','Biblioteca documental · aportes'),el('p',projectName||'Copropiedad asignada','muted'));
 heading.append(headingText);
 const caution=el('p','Todos los archivos quedan en cuarentena privada. Todavía no son memoria de Miss ADPHOR ni fuentes automáticas para informes. No se modifican originales de Google Drive.','notice');
 const linkForm=el('form','','panel adphor-simple-form');
 linkForm.append(el('h2','Registrar un enlace de Google Drive'),
  el('p','Se registra la referencia, pero no se descarga el documento ni se concede acceso OAuth.','muted'));
 const link=el('input');link.type='url';link.required=true;link.maxLength=500;
 link.placeholder='https://drive.google.com/file/d/.../view';
 const name=el('input');name.type='text';name.required=true;name.maxLength=180;
 name.placeholder='Nombre del documento';
 const sendLink=el('button','Registrar referencia para revisión','btn primary');sendLink.type='submit';
 const linkState=el('p');linkState.setAttribute('role','status');
 linkForm.append(label('Enlace directo de Drive',link),label('Nombre del documento',name),sendLink,linkState);
 const fileForm=el('form','','panel adphor-simple-form');
 fileForm.append(el('h2','Subir una copia descargada de Drive'),
  el('p','PDF, Word (DOCX) o Excel (XLSX) desde tu dispositivo, hasta 15 MB.','muted'));
 const file=el('input');file.type='file';file.required=true;
 file.accept='.pdf,.docx,.xlsx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
 const sendFile=el('button','Subir copia privada','btn primary');sendFile.type='submit';
 const fileState=el('p');fileState.setAttribute('role','status');
 fileForm.append(label('Archivo',file),sendFile,fileState);
 const history=el('section','','panel');
 history.append(el('h2','Mis documentos pendientes'));
 const refresh=el('button','Actualizar bandeja','btn secondary');refresh.type='button';
 const historyState=el('p','','muted');historyState.setAttribute('role','status');
 const items=el('ul');
 history.append(refresh,historyState,items);
 const active=()=>shell.isConnected;
 let sequence=0;
 async function load(){
  const request=++sequence;
  historyState.textContent='Consultando aportes autorizados…';items.replaceChildren();
  try{
   const rows=await repo.listMissDocuments(projectId);
   if(!active()||request!==sequence)return;
   historyState.textContent=rows.length
    ?rows.length+' aportes confirmados en cuarentena.'
    :'No hay aportes confirmados en esta copropiedad.';
   for(const row of rows){
    const item=el('li');
    item.append(el('strong',row.display_name),
      el('span',' · '+(row.source_kind==='drive_link'?'Referencia Drive':'Copia privada')+
       ' · En cuarentena'));
    items.append(item);
   }
  }catch{if(active()&&request===sequence)historyState.textContent='Bandeja no disponible. Revisa sesión, MFA y permisos.';}
 }
 linkForm.addEventListener('submit',async event=>{
  event.preventDefault();sendLink.disabled=true;linkState.textContent='Comprobando enlace…';
  try{
   await repo.submitMissDriveLink(projectId,link.value,name.value);
   linkState.textContent='Referencia registrada en cuarentena. Google Drive aún no ha sido importado.';
   linkForm.reset();await load();
  }catch(error){linkState.textContent=error?.message||'No se registró el enlace.';}
  finally{if(sendLink.isConnected)sendLink.disabled=false;}
 });
 fileForm.addEventListener('submit',async event=>{
  event.preventDefault();sendFile.disabled=true;fileState.textContent='Validando y almacenando copia privada…';
  try{
   if(!file.files||file.files.length!==1)throw Error('Selecciona un solo archivo.');
   await repo.submitMissLocalDocument(projectId,file.files[0]);
   fileState.textContent='Copia confirmada en cuarentena. No será leída hasta su revisión.';
   fileForm.reset();await load();
  }catch(error){fileState.textContent=error?.message||'No se confirmó la carga.';}
  finally{if(sendFile.isConnected)sendFile.disabled=false;}
 });
 refresh.addEventListener('click',load);
 shell.append(heading,caution,linkForm,fileForm,history);
 root.append(shell);void load();
}
