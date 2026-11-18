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
 const stale=Boolean(request&&new Date(request.source_reconciled_at).getTime()!==new Date(route.last_reconciled_at).getTime());
 return Object.freeze({
   projectId,
   readyForReview:route.readiness==='PENDING_APPROVAL'&&!request,
   pending:Boolean(request),
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
 const refresh=el('button','Actualizar estado');refresh.type='button';refresh.className='btn secondary';
 let current=null,busy=false;
 const updateButton=()=>{button.disabled=busy||!tick.checked||!current?.readyForReview;};
 tick.onchange=updateButton;
 async function readState(){
   if(busy)return;busy=true;button.disabled=true;refresh.disabled=true;
   try{
     const route=await repository.routeReadiness(projectId);
     const requests=await repository.listPendingRouteReviews(projectId);
     current=normalizeRecipientReview(route,requests,projectId);
     if(root.isConnected){state.textContent=current.statusText;confirm.hidden=!current.readyForReview;
       button.hidden=!current.readyForReview;}
   } catch(e){
     current=null;
     if(root.isConnected){state.textContent='No se pudo verificar el estado de revisión. Ningún envío está autorizado.';
       confirm.hidden=true;button.hidden=true;}
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
 card.append(state,confirm,button,refresh);root.append(card);
 void readState();
}
