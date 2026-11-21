// QA Integral: explicit document contributions from within Miss ADPHOR.
// The button uses the authenticated repository; it does not read Drive or feed AI.
export function requireMissDocumentScope(context) {
 const c=typeof context==='function'?context():null;
 if(!c || c.mode!=='cloud' || !c.userId || typeof c.projectId!=='string' ||
    !/^[a-z0-9][a-z0-9_-]{0,99}$/.test(c.projectId) || c.project?.id!==c.projectId)
  throw Error('Inicia sesión y selecciona una copropiedad autorizada para aportar archivos.');
 return Object.freeze({userId:c.userId,projectId:c.projectId,role:c.role,mode:c.mode});
}
export function sameMissDocumentScope(a,context) {
 try {
  const b=requireMissDocumentScope(context);
  return a.userId===b.userId&&a.projectId===b.projectId&&a.role===b.role&&a.mode===b.mode;
 } catch { return false; }
}
const element=(tag,text)=>{
 const node=document.createElement(tag);
 if(text)node.textContent=text;
 return node;
};
function field(title,node){
 const label=element('label');
 label.append(element('span',title),node);
 return label;
}
export function mountMissChatDocumentComposer(panel,{context,uploadDocument,submitDriveLink}={}) {
 if(!panel||typeof uploadDocument!=='function'||typeof submitDriveLink!=='function')
  return null;
 const details=element('details');
 details.className='miss-chat-documents';
 const summary=element('summary','Adjuntar archivo o enlace de Drive');
 const note=element('p','Tus aportes se reciben en cuarentena privada de la copropiedad seleccionada. No alimentan todavía las respuestas o informes de IA.');
 note.className='miss-chat-documents-note';
 const fileForm=element('form');fileForm.className='miss-chat-document-form';
 const fileInput=element('input');fileInput.type='file';fileInput.name='document';
 fileInput.accept='.pdf,.docx,.xlsx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
 fileInput.required=true;
 fileInput.setAttribute('aria-label','Seleccionar PDF, Word o Excel');
 const fileButton=element('button','Subir copia a cuarentena');fileButton.type='submit';
 const fileStatus=element('p');fileStatus.setAttribute('role','status');
 fileForm.append(field('PDF, Word o Excel (hasta 15 MB)',fileInput),fileButton,fileStatus);
 const driveForm=element('form');driveForm.className='miss-chat-document-form';
 const driveInput=element('input');driveInput.type='url';driveInput.name='drive';driveInput.maxLength=500;
 driveInput.placeholder='https://drive.google.com/file/d/.../view';driveInput.required=true;
 const nameInput=element('input');nameInput.type='text';nameInput.name='title';nameInput.maxLength=180;
 nameInput.placeholder='Ej. Acta del consejo';nameInput.required=true;
 const driveButton=element('button','Registrar enlace para revisión');driveButton.type='submit';
 const driveStatus=element('p');driveStatus.setAttribute('role','status');
 driveForm.append(field('Enlace directo de Drive',driveInput),field('Nombre del documento',nameInput),
  driveButton,driveStatus);
 details.append(summary,note,fileForm,driveForm);
 panel.append(details);
 let sendingFile=false,sendingDrive=false;
 fileForm.addEventListener('submit',async event=>{
  event.preventDefault();
  if(sendingFile)return;
  let scope;
  try {scope=requireMissDocumentScope(context);}
  catch(error){fileStatus.textContent=error.message;return;}
  if(!fileInput.files||fileInput.files.length!==1){
   fileStatus.textContent='Selecciona un archivo admitido.';return;
  }
  sendingFile=true;fileButton.disabled=true;fileStatus.textContent='Comprobando y guardando una copia privada…';
  try{
   await uploadDocument(scope.projectId,fileInput.files[0]);
   if(details.isConnected&&sameMissDocumentScope(scope,context)){
    fileStatus.textContent='Archivo guardado en cuarentena para revisión. Todavía no está disponible para la IA.';
    fileForm.reset();
   }
  }catch(error){
   if(details.isConnected&&sameMissDocumentScope(scope,context))
    fileStatus.textContent=error instanceof Error&&/^(Admite |No se confirmó |El archivo |La ruta |No fue posible |El encabezado |La extensión |Para aportar |Se requiere |No tienes |La bandeja )/.test(error.message)
     ?error.message:'No se pudo confirmar la carga. Verifica la sesión y vuelve a intentarlo.';
  }finally{sendingFile=false;if(details.isConnected)fileButton.disabled=false;}
 });
 driveForm.addEventListener('submit',async event=>{
  event.preventDefault();
  if(sendingDrive)return;
  let scope;
  try{scope=requireMissDocumentScope(context);}
  catch(error){driveStatus.textContent=error.message;return;}
  sendingDrive=true;driveButton.disabled=true;driveStatus.textContent='Comprobando la referencia…';
  try{
   await submitDriveLink(scope.projectId,driveInput.value,nameInput.value);
   if(details.isConnected&&sameMissDocumentScope(scope,context)){
    driveStatus.textContent='Enlace registrado en cuarentena. No se descargó el archivo de Drive.';
    driveForm.reset();
   }
  }catch{
   if(details.isConnected&&sameMissDocumentScope(scope,context))
    driveStatus.textContent='No se registró el enlace. Usa una URL directa y verifica tus permisos.';
  }finally{sendingDrive=false;if(details.isConnected)driveButton.disabled=false;}
 });
 return details;
}
