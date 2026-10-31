// Read-only staging adapter for José's Reuniones sheet.
// Never writes Google Calendar/Sheets, sends invites or embeds private attendee data.
const val=x=>String(x??'').trim();
const dateOk=s=>/^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s+'T12:00:00Z')) && new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s;
const parseClock=s=>{
 const m=String(s).trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*([ap]\.?m\.?)?$/i);
 if(!m)return null;
 let h=Number(m[1]),min=Number(m[2]);const suffix=m[3]?.replace(/\./g,'').toLowerCase();
 if(min>59||h>(suffix?12:23)||h<(suffix?1:0))return null;
 if(suffix)h=h%12+(suffix==='pm'?12:0);
 return String(h).padStart(2,'0')+':'+String(min).padStart(2,'0');
};
const parseDate=s=>{
 let candidate=String(s).trim();
 if(/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(candidate)){
  const [day,month,year]=candidate.split('/').map(Number);
  candidate=String(year).padStart(4,'0')+'-'+String(month).padStart(2,'0')+'-'+String(day).padStart(2,'0');
 }
 return dateOk(candidate)?candidate:null;
};
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
  const date=parseDate(get(row,'Fecha_Evento')),time=parseClock(get(row,'Hora Inicio Estimada'));
  if(!legacyId||!projectId||!date||!time){
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
