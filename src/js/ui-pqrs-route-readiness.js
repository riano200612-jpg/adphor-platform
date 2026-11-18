// QA Integral: read-only, per-property route readiness. Never disclose candidate email.
const STATUSES=Object.freeze({
 PENDING_APPROVAL:{title:'Coincidencia preliminar',detail:'Dos fuentes coinciden, pero el destinatario aún no está autorizado. No se enviará correo.'},
 CONFLICT:{title:'Datos contradictorios',detail:'Existen diferencias de nombre o correo entre las fuentes de la copropiedad. Deben aclararse antes de notificar.'},
 SOURCE_GAP:{title:'Falta corroboración del portal',detail:'Esta copropiedad figura en Master_ADPHOR, pero no en la hoja de referencia del portal consultada.'},
 MISSING_EMAIL:{title:'Falta correo del responsable',detail:'La fuente maestra no contiene un correo con formato válido para esta copropiedad.'}
});
export function normalizePqrsRouteReadiness(row,projectId) {
 if(!row||row.project_id!==projectId||!Object.hasOwn(STATUSES,row.readiness)||
    typeof row.candidate_email_present!=='boolean'||typeof row.issue_code!=='string'||
    row.issue_code.length>70)throw Error('Enrutamiento PQRS sin verificar para esta copropiedad.');
 const status=STATUSES[row.readiness];
 return Object.freeze({projectId,readiness:row.readiness,title:status.title,
   detail:status.detail,candidateEmailExists:row.candidate_email_present,
   emailDeliveryEnabled:false});
}
const el=(tag,content)=>{const e=document.createElement(tag);e.textContent=String(content);return e;};
export function mountPqrsRouteReadiness(root,{repository,projectId}){
 root.replaceChildren();
 const panel=el('section','');panel.className='panel pqrs-routing-readiness';panel.dataset.pqrsRoutingReadiness='';
 panel.append(el('h3','Notificación al encargado · Estado de certificación'));
 const description=el('p','Este diagnóstico usa una copia privada de las referencias de Drive; nunca modifica los archivos originales de José ni muestra correos. La entrega automática permanece deshabilitada.');
 description.className='muted';panel.append(description);
 const status=el('p','Verificando la ruta de esta copropiedad…');status.setAttribute('role','status');
 const button=el('button','Volver a comprobar');button.type='button';button.className='btn secondary';
 let busy=false;
 async function refresh(){
  if(busy)return;busy=true;button.disabled=true;
  try {
   const answer=normalizePqrsRouteReadiness(await repository.routeReadiness(projectId),projectId);
   if(root.isConnected)status.textContent=answer.title+'. '+answer.detail;
  } catch(_) {
   if(root.isConnected)status.textContent='No se pudo verificar el destinatario. No se autoriza ningún envío.';
  } finally {busy=false;if(button.isConnected)button.disabled=false;}
 }
 button.onclick=refresh;
 panel.append(status,button);root.append(panel);
 void refresh();
}
