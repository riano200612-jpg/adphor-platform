// ADPHOR QA client-source review. Browser-local only; never sends uploads to a server.
// Historical records are not confirmed Google Calendar events or operational PQRS.
const MAX_ZIP=175*1024*1024,MAX_UNPACKED=8*1024*1024;
const text=(tag,value,cls='')=>{const n=document.createElement(tag);if(cls)n.className=cls;n.textContent=String(value??'');return n;};
function readZipIndex(buffer){
 const view=new DataView(buffer);const bytes=new Uint8Array(buffer);
 let end=-1;
 for(let i=buffer.byteLength-22;i>=Math.max(0,buffer.byteLength-65557);i--){
   if(view.getUint32(i,true)===0x06054b50){end=i;break;}
 }
 if(end<0)throw Error('Archivo ZIP inválido: directorio final no encontrado.');
 const count=view.getUint16(end+10,true),offset=view.getUint32(end+16,true);
 if(count>4000||offset>=buffer.byteLength)throw Error('ZIP demasiado grande o no compatible.');
 const decoder=new TextDecoder(),items=new Map();let pos=offset;
 for(let i=0;i<count;i++){
   if(view.getUint32(pos,true)!==0x02014b50)throw Error('Directorio ZIP corrupto.');
   const method=view.getUint16(pos+10,true),compressed=view.getUint32(pos+20,true),
   unpacked=view.getUint32(pos+24,true),nlen=view.getUint16(pos+28,true),
   extra=view.getUint16(pos+30,true),comment=view.getUint16(pos+32,true),
   local=view.getUint32(pos+42,true);
   const name=decoder.decode(bytes.subarray(pos+46,pos+46+nlen));
   if(name.includes('..')||name.startsWith('/')||local+30>buffer.byteLength)throw Error('Nombre ZIP inseguro o corrupto.');
   if(view.getUint32(local,true)!==0x04034b50)throw Error('Entrada ZIP inválida.');
   const start=local+30+view.getUint16(local+26,true)+view.getUint16(local+28,true);
   if(start+compressed>buffer.byteLength)throw Error('Contenido ZIP truncado.');
   items.set(name,{name,method,start,compressed,unpacked});
   pos+=46+nlen+extra+comment;
 }
 return items;
}
async function extractZip(buffer,entry,max=MAX_UNPACKED){
 if(entry.unpacked>max)throw Error('Entrada excede el límite de memoria permitido.');
 const slice=buffer.slice(entry.start,entry.start+entry.compressed);
 let bytes;
 if(entry.method===0)bytes=new Uint8Array(slice);
 else if(entry.method===8){
   if(typeof DecompressionStream==='undefined')throw Error('Este navegador no admite descompresión ZIP.');
   const stream=new Blob([slice]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
   bytes=new Uint8Array(await new Response(stream).arrayBuffer());
 }else throw Error('Método de compresión ZIP no compatible.');
 if(bytes.length!==entry.unpacked||bytes.length>max)throw Error('Contenido ZIP no coincide con los metadatos.');
 return bytes;
}
const parseJsonl=bytes=>{
 const rows=[];
 for(const line of new TextDecoder().decode(bytes).split(/\r?\n/)){
   if(!line.trim())continue;
   if(rows.length>2500)throw Error('Archivo con demasiadas filas.');
   const row=JSON.parse(line);if(!row||typeof row!=='object'||Array.isArray(row))throw Error('Fila inválida.');
   rows.push(row);
 }return rows;
};
export async function loadClientSourceZip(file){
 if(!file||file.size>15*1024*1024)throw Error('Selecciona el ZIP privado conciliado de menos de 15 MB.');
 const buffer=await file.arrayBuffer(),entries=readZipIndex(buffer),required=[
  'projects.jsonl','meeting_history_mapped.jsonl','meeting_history_quarantine.jsonl',
  'pqrs_history.jsonl','delegates_directory_no_credentials.jsonl'
 ];
 const data={};
 for(const name of required){
   const entry=entries.get(name);if(!entry)throw Error('Falta '+name+'; utiliza el paquete privado conciliado.');
   data[name]=parseJsonl(await extractZip(buffer,entry));
 }
 return {projects:data['projects.jsonl'],meetings:data['meeting_history_mapped.jsonl'],
   quarantined:data['meeting_history_quarantine.jsonl'],pqrs:data['pqrs_history.jsonl'],
   delegates:data['delegates_directory_no_credentials.jsonl']};
}
// Exact, accent-insensitive name match only; never infer a person's identity from an image.
export function staffNameKey(value){
 return String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
   .toLowerCase().replace(/[^a-z0-9]/g,'');
}
export function staffForProject(project,delegates){
 if(!project||!Array.isArray(delegates))return [];
 const ids=[project.ID_Delegado,project.ID_Coordinador]
   .filter(x=>x!==null&&x!==undefined&&String(x).trim()!==''&&String(x)!=='0')
   .map(String);
 return delegates.filter(x=>ids.includes(String(x.ID_Delegado)));
}
export function photoForStaff(person,entries){
 const expected=staffNameKey(person?.Delegado);if(!expected)return null;
 return (Array.isArray(entries)?entries:[]).find(x=>{
   if(!/^media\/fotosColaboradores\//i.test(x.name)||!\/\.(jpg|jpeg|png|webp)$/i.test(x.name))return false;
   const base=x.name.split('/').pop().replace(/\.[^.]+$/,'').replace(/^\d+\.\s*/,'');
   return staffNameKey(base)===expected;
 })||null;
}
const safeDay=v=>/^\d{4}-\d{2}-\d{2}$/.test(String(v||''))?String(v):'';
const safeClock=v=>/^\d{2}:\d{2}/.test(String(v||''))?String(v).slice(0,5):'';
export function selectProjectMeetings(rows,id){
 return (Array.isArray(rows)?rows:[]).filter(r=>String(r.source_project_id)===String(id)
  && safeDay(r.event_date)&&r.historical_only===true);
}
function drawCalendar(where,meetings,month){
 where.replaceChildren();
 const header=text('h3','Calendario histórico · '+month);
 const info=text('p','Solo registros del archivo del cliente. No verifica disponibilidad ni confirma reservas en Google Calendar.','notice');
 where.append(header,info);
 const grid=text('div','','calendar-grid month');
 const [year,m]=month.split('-').map(Number);
 const first=(new Date(Date.UTC(year,m-1,1)).getUTCDay()+6)%7;
 for(let i=0;i<first;i++)grid.append(text('div',''));
 const total=new Date(Date.UTC(year,m,0)).getUTCDate();
 for(let d=1;d<=total;d++){
   const key=month+'-'+String(d).padStart(2,'0');
   const cell=text('article',String(d),'calendar-day');
   const events=meetings.filter(x=>x.event_date===key);
   for(const e of events.slice(0,3)){
     const item=text('small',safeClock(e.start_local)+' · '+String(e.meeting_type||'Reunión').slice(0,55));
     cell.append(item);
   }
   if(events.length>3)cell.append(text('small','+'+(events.length-3)+' registros'));
   grid.append(cell);
 }where.append(grid);
}
function simpleCard(root,title,details){
 const card=text('article','','panel');card.append(text('h4',title),text('p',details,'muted'));root.append(card);return card;
}
export function mountClientSourceReview(root){
 root.replaceChildren();
 const host=text('section','','panel');
 host.append(text('p','REVISIÓN PRIVADA · ADMINISTRADOR','eyebrow'),
   text('h1','Datos históricos reales del cliente'),
   text('p','Carga temporal en este navegador. No se envían archivos, no se guardan datos en Supabase ni se crean reuniones/PQRS. Cierra o recarga para borrar la vista.','notice'));
 const pkg=text('input');pkg.type='file';pkg.accept='.zip,application/zip';pkg.setAttribute('aria-label','Seleccionar paquete privado conciliado');
 const photo=text('input');photo.type='file';photo.accept='.zip,application/zip';photo.setAttribute('aria-label','Seleccionar ZIP multimedia de colaboradores (opcional)');
 host.append(text('label','1. Paquete ADPHOR_QA_PAQUETE_PRIVADO_CONCILIADO_20261103.zip'),pkg,
   text('label','2. ZIP multimedia, opcional (se procesa localmente)'),photo);
 const state=text('p','Selecciona primero el paquete conciliado.','muted');state.setAttribute('role','status');host.append(state);
 const content=text('div');root.append(host,content);
 let records=null,photoData=null,photoIndex=null,previewUrls=[];
 const clearUrls=()=>{for(const u of previewUrls)URL.revokeObjectURL(u);previewUrls=[];};
 function render(){
  clearUrls();content.replaceChildren();if(!records)return;
  const summary=text('section','','panel');
  summary.append(text('h2','Inventario cargado desde el archivo'),
    text('p',records.projects.length+' copropiedades · '+records.meetings.length+' actividades vinculadas · '+records.quarantined.length+' en cuarentena · '+records.pqrs.length+' PQRS · '+records.delegates.length+' delegados.'));
  content.append(summary);
  const label=text('label','Copropiedad del archivo (no asigna permisos ni modifica Supabase)');
  const select=text('select');for(const p of records.projects){const op=text('option',p.Copropiedad);op.value=String(p.ID_Copropiedad);select.append(op);}
  label.append(select);content.append(label);
  const calendarHost=text('section','','panel'),listHost=text('section','','panel'),pqrsHost=text('section','','panel'),peopleHost=text('section','','panel');
  content.append(calendarHost,listHost,pqrsHost,peopleHost);
  const makeView=()=>{
   clearUrls();const p=records.projects.find(x=>String(x.ID_Copropiedad)===select.value);if(!p)return;
   const rows=selectProjectMeetings(records.meetings,p.ID_Copropiedad);
   const dates=rows.map(r=>safeDay(r.event_date)).filter(Boolean).sort();
   const current=new Date().toISOString().slice(0,7);
   let month=current;
   const monthSelect=text('input');monthSelect.type='month';monthSelect.value=current;
   const calendarArea=text('div');
   const renderMonth=()=>drawCalendar(calendarArea,rows,monthSelect.value||month);
   calendarHost.replaceChildren(text('h2','Agenda del archivo'),monthSelect,calendarArea);monthSelect.onchange=renderMonth;renderMonth();
   listHost.replaceChildren(text('h2','Reuniones históricas · '+rows.length));
   for(const x of rows.slice().sort((a,b)=>String(b.event_date).localeCompare(String(a.event_date))).slice(0,70)){
     simpleCard(listHost, (x.event_date||'Fecha no válida')+' · '+(x.meeting_type||'Reunión'),
       [safeClock(x.start_local),x.status_source,x.modality].filter(Boolean).join(' · '));
   }
   if(rows.length>70)listHost.append(text('p','Se muestran las 70 más recientes.','muted'));
   pqrsHost.replaceChildren(text('h2','PQRS del archivo · '+records.pqrs.length),
      text('p','Los 29 expedientes no tienen relación unívoca de copropiedad certificada. Para proteger la privacidad se muestran únicamente cifras; no se muestran detalles ni se permiten respuestas.','notice'));
   const assigned=staffForProject(p,records.delegates);
   peopleHost.replaceChildren(text('h2','Personal asignado · Fotografía, rol y sector'),
    text('p','Solo se muestran personas relacionadas por ID con esta copropiedad en el maestro. La asignación operativa, disponibilidad y responsabilidades deben validarse en el sistema de personal.','notice'));
   const photos=text('div','','meeting-escort-carousel');photos.setAttribute('role','list');peopleHost.append(photos);
   if(!assigned.length){photos.append(text('p','No hay personal vinculado de forma inequívoca a esta copropiedad.','muted'));}
   for(const person of assigned){
     const card=text('article','','meeting-escort-card');card.setAttribute('role','listitem');
     card.append(text('strong',person.Delegado||'Sin nombre'));
     const roleDetail=person['Leyenda Rol']||person.Rol||'Cargo no definido';
     card.append(text('small','Cargo / función registrada: '+roleDetail));
     if(person['Sector Coordinado']&&person['Sector Coordinado']!=='NA')
       card.append(text('small','Sector: '+person['Sector Coordinado']));
     card.append(text('small','Relación con copropiedad: '+p.Copropiedad));
     if(person.Estado)card.append(text('small','Estado en origen: '+person.Estado));
     const entry=photoIndex?photoForStaff(person,[...photoIndex.values()]):null;
     if(entry&&photoData){
       const image=document.createElement('img');
       image.alt='Fotografía aportada del colaborador '+person.Delegado;image.loading='lazy';
       image.width=92;image.height=92;
       card.prepend(image);
       const mime=/\.png$/i.test(entry.name)?'image/png':/\.webp$/i.test(entry.name)?'image/webp':'image/jpeg';
       extractZip(photoData,entry,8*1024*1024).then(bytes=>{
         if(!card.isConnected)return;
         const uri=URL.createObjectURL(new Blob([bytes],{type:mime}));previewUrls.push(uri);image.src=uri;
       }).catch(()=>card.append(text('small','No se pudo abrir la fotografía autorizada.')));
     }else card.append(text('small','Sin fotografía vinculada en el ZIP seleccionado.'));
     const assign=text('button','Asignar novedad');assign.type='button';assign.className='btn secondary';assign.disabled=true;
     assign.title='Pendiente de autorización y validación de responsabilidades en backend';
     card.append(assign);photos.append(card);
   }
   if(!photoIndex)peopleHost.append(text('p','Carga el ZIP multimedia del cliente para mostrar fotografías vinculadas a los nombres.','muted'));
  };
  select.onchange=makeView;makeView();
 }
 pkg.onchange=async()=>{records=null;content.replaceChildren();state.textContent='Validando paquete...';
  try{records=await loadClientSourceZip(pkg.files?.[0]);state.textContent='Paquete verificado y cargado solo en este navegador.';render();}
  catch(e){state.textContent='No se pudo abrir el paquete: '+e.message;}
 };
 photo.onchange=async()=>{
   try{
     const file=photo.files?.[0];if(!file||file.size>MAX_ZIP)throw Error('ZIP multimedia supera el límite de 175 MB.');
     photoData=await file.arrayBuffer();photoIndex=readZipIndex(photoData);
     state.textContent='ZIP multimedia validado localmente.';render();
   }catch(e){state.textContent='Error ZIP multimedia: '+e.message;}
 };
}
