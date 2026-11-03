// ADPHOR QA: status of the private historical PQRS source; no privileged data in the browser.
// Counts are a dated audit snapshot, NOT live operational records.
export const PQRS_SOURCE_AUDIT = Object.freeze({
  snapshot:'2026-11-03',
  source:'Master_ADPHOR.xlsx · hoja PQRS',
  cases:29,
  sourceStatus:'Abierto',
  operationalConnected:false
});

export function mountPqrsSourceStatus(target,{repo,projectId}={}) {
  target.replaceChildren();
  const panel=document.createElement('section');
  panel.className='panel pqrs-page';
  const eyebrow=document.createElement('p');eyebrow.className='eyebrow';eyebrow.textContent='CENTRO DE ATENCIÓN · ADPHOR';
  const title=document.createElement('h1');title.textContent='PQRS · Seguimiento histórico';
  const summary=document.createElement('p');summary.className='notice';
  summary.textContent='Datos verificados del archivo de origen, no solicitudes operativas sincronizadas. La radicación y las respuestas permanecen bloqueadas hasta que la base QA con RLS esté certificada.';
  const count=document.createElement('h2');count.textContent='29 PQRS identificadas en el origen';
  const meta=document.createElement('p');meta.className='muted';meta.textContent='Corte: 3 de noviembre de 2026 · Fuente: Master_ADPHOR.xlsx · 29 casos con estado Abierto en el archivo recibido.';
  const info=document.createElement('p');info.textContent='Para consultar expedientes y adjuntos reales se requiere relacionar cada caso con una copropiedad autorizada y activar el servicio PostgreSQL con control de acceso.';
  const action=document.createElement('button');action.type='button';action.className='btn secondary';action.disabled=true;action.textContent='Radicación real pendiente de conexión segura';
  panel.append(eyebrow,title,summary,count,meta,info,action);
  const history=document.createElement('section');history.className='panel';
  const heading=document.createElement('h2');heading.textContent='Casos autorizados en PostgreSQL QA';
  const list=document.createElement('div');list.className='pqrs-cases';
  list.textContent='Sin datos operativos QA disponibles. El inventario histórico requiere homologación y autorización.';
  history.append(heading,list);
  target.append(panel,history);
  if(repo && typeof repo.listQaPqrsHistory==='function' && projectId){
    repo.listQaPqrsHistory(projectId).then(rows=>{
      if(!target.isConnected)return;
      list.replaceChildren();
      if(!rows?.length){list.textContent='No hay PQRS homologadas visibles para esta copropiedad.';return;}
      for(const r of rows){
        const card=document.createElement('article');card.className='panel';
        const title=document.createElement('h3');title.textContent=r.subject;
        const state=document.createElement('p');state.textContent='Radicado histórico '+r.source_id+' · Estado en origen: '+r.source_status;
        card.append(title,state);list.append(card);
      }
    }).catch(error=>{
      if(target.isConnected)list.textContent='No se pudo consultar la fuente QA autorizada: '+error.message;
    });
  }
}
