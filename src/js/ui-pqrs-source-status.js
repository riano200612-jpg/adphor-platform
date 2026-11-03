// ADPHOR QA: status of the private historical PQRS source; no privileged data in the browser.
// Counts are a dated audit snapshot, NOT live operational records.
export const PQRS_SOURCE_AUDIT = Object.freeze({
  snapshot:'2026-11-03',
  source:'Master_ADPHOR.xlsx · hoja PQRS',
  cases:29,
  sourceStatus:'Abierto',
  operationalConnected:false
});

export function mountPqrsSourceStatus(target) {
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
  target.append(panel);
}
