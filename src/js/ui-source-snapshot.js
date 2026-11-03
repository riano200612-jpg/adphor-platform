// Aggregated client-source evidence only. No row-level, staff, or property data.
// Verified against 2026-11-03 uploaded ZIP; this is NOT a live calendar or PQRS feed.
export const ADPHOR_SOURCE_SNAPSHOT=Object.freeze({
  observedAt:'2026-11-03',
  source:'Master_ADPHOR.xlsx · paquete autorizado del cliente',
  figures:Object.freeze([
    {label:'Copropiedades en el archivo',value:44,detail:'Catálogo histórico; todavía sin homologar a permisos operativos'},
    {label:'Registros de actividades',value:684,detail:'628 vinculables por nombre; 56 en cuarentena'},
    {label:'PQRS históricas',value:29,detail:'29 figuran abiertas en la versión recibida'},
    {label:'Delegados en el origen',value:55,detail:'No son cuentas ni miembros autorizados en Supabase'},
    {label:'Ediciones históricas',value:368,detail:'Registro de cambios del maestro recibido'}
  ]),
  pending:Object.freeze(['Importación autorizada a PostgreSQL QA','Vinculación por copropiedad y RLS','Contraste de reservas con Google Calendar','PQRS transaccionales y adjuntos privados'])
});
export function mountSourceSnapshot(target,{snapshot=ADPHOR_SOURCE_SNAPSHOT}={}){
  const section=document.createElement('section');section.className='panel source-audit-panel';
  const kicker=document.createElement('p');kicker.className='eyebrow';kicker.textContent='INFORMACIÓN REAL · FUENTE VERIFICADA';
  const title=document.createElement('h2');title.textContent='Inventario del cliente recibido';
  const desc=document.createElement('p');desc.className='notice';
  desc.textContent='Corte '+snapshot.observedAt+'. Estas cifras proceden del archivo histórico del cliente. No equivalen a reuniones agendadas hoy ni a PQRS ya migradas a PostgreSQL.';
  const cards=document.createElement('div');cards.className='module-grid';
  for(const entry of snapshot.figures){
    const card=document.createElement('article');card.className='module-card';
    const number=document.createElement('strong');number.textContent=String(entry.value);
    const label=document.createElement('span');label.textContent=entry.label;
    const detail=document.createElement('small');detail.textContent=entry.detail;
    card.append(number,label,detail);cards.append(card);
  }
  const provenance=document.createElement('p');provenance.className='muted';
  provenance.textContent='Procedencia: '+snapshot.source+'. Se excluyen nombres, documentos, fotografías y credenciales personales.';
  section.append(kicker,title,desc,cards,provenance);
  target.append(section);
  return section;
}
