const MINUTE = 60000;
export function hasMeetingConflict({date,time,property,durationMinutes=60}, meetings, bufferMinutes=30) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? '') || !/^\d{2}:\d{2}$/.test(time ?? '') || !property || !(durationMinutes>0)) throw new Error('Solicitud inválida');
  const start=Date.parse(`${date}T${time}:00-05:00`);
  if (!Number.isFinite(start)) throw new Error('Fecha inválida');
  const end=start+durationMinutes*MINUTE;
  return meetings.some(m=>{
    if (m.property!==property) return false;
    const other=Date.parse(`${m.date}T${m.time}:00-05:00`);
    if (!Number.isFinite(other)) return false;
    const otherEnd=other+(m.durationMinutes || 60)*MINUTE;
    return start < otherEnd+bufferMinutes*MINUTE && end+bufferMinutes*MINUTE > other;
  });
}
export function getSyntheticSlots(request, meetings, times=['09:00','11:00','15:00']) {
  return times.filter(time=>!hasMeetingConflict({...request,time},meetings));
}
