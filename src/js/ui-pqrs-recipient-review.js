// QA Integral only. Requests a review, never approves an email or triggers delivery.
// All external fields are reduced to controlled status and timestamps.
export function normalizeRecipientReview(route,requests,projectId) {
 const allowed=['PENDING_APPROVAL','CONFLICT','SOURCE_GAP','MISSING_EMAIL'];
 if(!route||route.project_id!==projectId||!allowed.includes(route.readiness)||
    typeof route.last_reconciled_at!=='string'||!Number.isFinite(Date.parse(route.last_reconciled_at))||
    !Array.isArray(requests)||requests.length>1)
   throw Error('No fue posible certificar la revisión de destinatarios.');
 const request=requests[0]||null;
 if(request&&(
    request.project_id!==projectId||request.status!=='PENDING'||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(request.id)||
    typeof request.source_reconciled_at!=='string'||
    !Number.isFinite(Date.parse(request.source_reconciled_at))||
    typeof request.requested_at!=='string'||!Number.isFinite(Date.parse(request.requested_at))
  ))throw Error('La revisión recuperada no cumple el contrato.');
 const isMine=request?.is_mine===true;
 if(request && request.is_mine!==undefined && typeof request.is_mine!=='boolean')
   throw Error('Identidad de solicitud inválida.');
 const stale=Boolean(request&&new Date(request.source_reconciled_at).getTime()!==new Date(route.last_reconciled_at).getTime());
 return Object.freeze({
   projectId,
   readyForReview:route.readiness==='PENDING_APPROVAL'&&!request,
   pending:Boolean(request),
   canCancel:Boolean(request&&isMine),
   canReject:Boolean(request&&!isMine),
   stale,
   deliveryAuthorized:false,
   statusText:request?(stale?'La información cambió después de solicitar revisión. Se requiere conciliación administrativa.':'Existe una solicitud pendiente de verificación. Aún no autoriza enviar correos.'):
    route.readiness==='PENDING_APPROVAL'?'Contacto coincidente entre fuentes. Se puede solicitar su revisión formal, sin activar envíos.':
    'La fuente tiene discrepancias o datos incompletos. No se puede solicitar aprobación.',
 });
}
const el=(tag,text)=>{const n=document.createElement(tag);n.textContent=String(text);return n;};
export function mountRecipientReviewRequest(root,{repository,projectId}){
 root.replaceChildren();
 const card=el('section','');card.className='panel pqrs-recipient-review';card.dataset.pqrsRecipientReview='';
 card.append(el('h3','Verificación formal del destinatario'));
 const info=el('p','Solicitud administrativa interna de revisión; no modifica archivos originales, no aprueba correos ni envía notificaciones.');
 info.className='muted';card.append(info);
 const state=el('p','Consultando la información segura…');state.setAttribute('role','status');
 const confirm=el('label','');const tick=document.createElement('input');tick.type='checkbox';
 confirm.append(tick,document.createTextNode(' Entiendo que solicito una verificación, no un envío de correo.'));
 const button=el('button','Solicitar verificación');button.type='button';button.className='btn secondary';button.disabled=true;
 const closeConfirm=el('label','');const closeTick=document.createElement('input');closeTick.type='checkbox';
 closeConfirm.append(closeTick,document.createTextNode(' Confirmo cerrar esta revisión pendiente. Esta decisión no autoriza enviar correos.'));
 const cancel=el('button','Cancelar mi solicitud');cancel.type='button';cancel.className='btn secondary';
 const reject=el('button','Rechazar revisión ajena');reject.type='button';reject.className='btn secondary';
 const refresh=el('button','Actualizar estado');refresh.type='button';refresh.className='btn secondary';
 let current=null,busy=false;
 const updateButton=()=>{
   button.disabled=busy||!tick.checked||!current?.readyForReview;
   cancel.disabled=busy||!closeTick.checked||!current?.canCancel;
   reject.disabled=busy||!closeTick.checked||!current?.canReject;
 };
 closeTick.onchange=updateButton;
 tick.onchange=updateButton;
 async function readState(){
   if(busy)return;busy=true;button.disabled=true;refresh.disabled=true;
   try{
     const route=await repository.routeReadiness(projectId);
     const requests=await repository.listPendingRouteReviews(projectId);
     current=normalizeRecipientReview(route,requests,projectId);
     if(root.isConnected){state.textContent=current.statusText;confirm.hidden=!current.readyForReview;
       button.hidden=!current.readyForReview;cancel.hidden=!current.canCancel;
       reject.hidden=!current.canReject;closeConfirm.hidden=!current.pending;
       if(!current.pending)closeTick.checked=false;}
   } catch(e){
     current=null;
     if(root.isConnected){state.textContent='No se pudo verificar el estado de revisión. Ningún envío está autorizado.';
       confirm.hidden=true;button.hidden=true;cancel.hidden=true;reject.hidden=true;closeConfirm.hidden=true;}
   } finally{busy=false;if(refresh.isConnected)refresh.disabled=false;updateButton();}
 }
 refresh.onclick=()=>{void readState();};
 button.onclick=async()=>{
   if(busy||!tick.checked||!current?.readyForReview)return;
   busy=true;updateButton();
   try{
     await repository.requestRouteReview(projectId);
     tick.checked=false;
     state.textContent='Solicitud registrada. Correo pendiente de certificación; no se envió ninguna notificación.';
   }catch(_){
     state.textContent='No se pudo registrar la solicitud. Ningún envío está autorizado.';
   }finally{busy=false;updateButton();void readState();}
 };
 async function closeReview(decision) {
   if(busy||!closeTick.checked||
      !(decision==='CANCELLED'?current?.canCancel:decision==='REJECTED'?current?.canReject:false))return;
   busy=true;updateButton();
   try{
     await repository.decideRouteReview(projectId,decision);
     closeTick.checked=false;
     state.textContent='Revisión cerrada y registrada. Ningún correo fue enviado.';
   } catch(_) {
     state.textContent='No se pudo confirmar la decisión. La notificación permanece bloqueada.';
   } finally{busy=false;updateButton();void readState();}
 }
 cancel.onclick=()=>{void closeReview('CANCELLED');};
 reject.onclick=()=>{void closeReview('REJECTED');};
 card.append(state,confirm,button,closeConfirm,cancel,reject,refresh);root.append(card);
 void readState();
}
