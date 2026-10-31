// Read-only staging adapter for José's Reuniones sheet.
// Never writes Google Calendar/Sheets, sends invites or embeds private attendee data.
const val=x=>String(x??'').trim();
const dateOk=s=>/^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s+'T12:00:00Z')) && new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s;
const clockOk=s=>/^([01]\d|2[0-3]):[0-5]\d$/.test(s);
export function prepareLegacyMeetingRows(rows,{projectIdByLegacyName={}}={}) {
 if(!Array.isArray(rows)||rows.length===0)return {meetings:[],rejected:[]};
 const header=rows[0].map(val),required=['ID_Reunion','Copropiedad','Tipo','Fecha_Evento','Hora Inicio Estimada','Estado'];
 if(required.some(x=>!header.includes(x)))throw Error('Encabezados de reuniones incompletos');
 const ix=name=>header.indexOf(name);
 const get=(row,name)=>ix(name)<0?'':val(row[ix(name)]);
 const seen=new Set(),meetings=[],rejected=[];
 for(let rowIndex=1;rowIndex<rows.length;rowIndex++){
  const row=rows[rowIndex],legacyId=get(row,'ID_Reunion'),property=get(row,'Copropiedad');
  const projectId=val(projectIdByLegacyName[property]);
  const date=get(row,'Fecha_Evento'),time=get(row,'Hora Inicio Estimada');
  if(!legacyId||!projectId||!dateOk(date)||!clockOk(time)){
   rejected.push({row:rowIndex+1,reason:'identity_or_datetime_unmapped'});continue;
  }
  const key=projectId+':'+legacyId;
  if(seen.has(key)){rejected.push({row:rowIndex+1,reason:'duplicate_id'});continue;}
  seen.add(key);
  meetings.push({legacy_id:legacyId,project_id:projectId,
   type:get(row,'Tipo'),specification:get(row,'Especificación'),
   event_date:date,start_local:time,modality:get(row,'Modalidad'),status:get(row,'Estado'),
   read_only:true,source:'jose_reuniones_sheet',import_status:'candidate'});
 }
 return {meetings,rejected};
}
