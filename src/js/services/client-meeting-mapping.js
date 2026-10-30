// Functional, credential-free mapping of José's Calendario.gs meeting nomenclature.
// No CalendarApp calls, service IDs, email dispatch or Google writes in this module.
export function buildClientMeetingTitle({type,subType='',specification='',property,modality,test=false}) {
  if(!type||!property||!modality)throw Error('Tipo, copropiedad y modalidad son obligatorios.');
  const kind=type==='Consejo'&&subType==='Pre-Asamblea'?'Pre-Asamblea (Consejo)':type;
  const isCorporate=property==='ADPHOR';
  const text=isCorporate?kind+' - ADPHOR - '+modality:
    kind+' '+String(specification).trim()+' - '+property+' - '+modality;
  return (test?'[TEST] ':'')+(modality==='Presencial'?(isCorporate?'🏳️ ':'🚩 '):'')+text;
}
export function meetingColorCategory(type,status) {
  const confirmed=String(status||'').toLowerCase().includes('confirmad');
  if(String(type).includes('Asamblea'))return confirmed?'default':'gray';
  if(String(type).includes('Consejo'))return confirmed?'pale_blue':'gray';
  if(String(type).includes('Comité'))return confirmed?'pale_green':'gray';
  return confirmed?'mauve':'gray';
}
export function parseClientLocalDateTime(date,time) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(date))|| !/^\d{1,2}:\d{2}(?:\s*[aApP][mM])?$/.test(String(time).trim())) throw Error('Fecha u hora inválidas.');
  const match=String(time).trim().match(/^(\d{1,2}):(\d{2})(?:\s*([ap]m))?$/i);
  let h=Number(match[1]),m=Number(match[2]);const modifier=match[3]?.toLowerCase();
  if(m>59||h>(modifier?12:23)||h<(modifier?1:0))throw Error('Hora fuera de rango.');
  if(modifier)h=h%12+(modifier==='pm'?12:0);
  const value=new Date(date+'T'+String(h).padStart(2,'0')+':'+String(m).padStart(2,'0'));
  if(!Number.isFinite(value.getTime())||value.getFullYear()!==Number(date.slice(0,4))||value.getMonth()+1!==Number(date.slice(5,7))||value.getDate()!==Number(date.slice(8,10)))throw Error('Fecha inválida.');
  return value;
}
