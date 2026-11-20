import {missQaCurrentWeek} from './services/qa-miss-weekly-report.js';
const ITEMS=[['tasksCreated','Tareas nuevas'],['tasksOverdueAtCutoff','Tareas vencidas al corte'],['visitsRegistered','Visitas registradas'],['visitsFinished','Visitas finalizadas'],['pqrsNew','PQRS nuevas'],['pqrsClosed','PQRS cerradas'],['meetingsImported','Reuniones importadas']];
const el=(tag,value)=>{const n=document.createElement(tag);n.textContent=value;return n;};
const number=x=>Number.isSafeInteger(x)?String(x):'NO DISPONIBLE';
export function missQaWeeklyCsv(report,projects){
 const names=new Map(projects.map(p=>[p.id,p.name]));
 const cell=x=>{let s=String(x??'');if(/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};
 const r=[['Copropiedad',...ITEMS.map(x=>x[1])]];
 for(const p of report.properties)r.push([names.get(p.projectId)||'Copropiedad autorizada',...ITEMS.map(([k])=>number(p[k]))]);
 r.push(['TOTAL',...ITEMS.map(([k])=>number(report.totals[k]))]);
 return '\ufeff'+r.map(x=>x.map(cell).join(';')).join('\r\n')+'\r\n';
}
export function mountMissQaWeekly(container,{repo,projects=[],projectId,corporateAdmin=false,mode,role,now=()=>Date.now()}={}){
 if(!container)return;
 const token=Symbol('miss-qa-weekly');container.__missQaWeek=token;
 const valid=()=>container.isConnected&&container.__missQaWeek===token;
 container.replaceChildren();
 const wrapper=el('section','');wrapper.className='panel miss-qa-weekly';
 wrapper.append(el('h2','Miss ADPHOR · Informe gerencial semanal'));
 wrapper.append(el('p','Borrador de lectura, por copropiedades autorizadas y con datos verificables. No publica ni envía informes.'));
 if(mode!=='cloud'||!['admin','coordinator'].includes(role)||typeof repo?.missWeeklyPreview!=='function'){
   wrapper.append(el('p','Requiere una cuenta QA de Administración/Coordinación y MFA AAL2.'));
   container.append(wrapper);return;
 }
 const controls=el('div','');controls.className='miss-qa-weekly-actions no-print';
 const select=el('select','');select.setAttribute('aria-label','Alcance del informe semanal');
 const selected=el('option','Solo este edificio');selected.value='single';select.append(selected);
 if(corporateAdmin&&projects.length>1){const opt=el('option','Mis copropiedades autorizadas');opt.value='all';select.append(opt);}
 const run=el('button','Preparar informe semanal');run.className='btn primary';run.type='button';
 const status=el('p','Consulta solo las fuentes que tu sesión permite leer.');status.setAttribute('role','status');
 const result=el('div','');controls.append(select,run);wrapper.append(controls,status,result);container.append(wrapper);
 run.addEventListener('click',async()=>{
  if(run.disabled||!valid())return;
  run.disabled=true;status.textContent='Miss ADPHOR está verificando permisos y consolidando los datos…';result.replaceChildren();
  const ids=select.value==='all'&&corporateAdmin?projects.map(p=>p.id):[projectId];
  try{
   const report=await repo.missWeeklyPreview({weekStart:missQaCurrentWeek(now()),projectIds:ids});
   if(!valid())return;
   if(report.propertyCount!==ids.length||report.properties.some(x=>!ids.includes(x.projectId)))throw Error('Datos fuera del alcance.');
   result.append(el('h3','Semana del '+report.weekStart+' · '+report.propertyCount+' copropiedades'));
   result.append(el('p',report.note));
   const table=el('table','');table.className='miss-qa-weekly-table';
   const header=el('tr','');header.append(el('th','Indicador'),el('th','Total'));const thead=el('thead','');thead.append(header);table.append(thead);
   const tbody=el('tbody','');
   for(const [key,label] of ITEMS){const tr=el('tr','');tr.append(el('td',label),el('td',number(report.totals[key])));tbody.append(tr);}
   const tr=el('tr','');tr.append(el('td','Tareas terminadas / cumplimiento'),el('td','NO DISPONIBLE'));tbody.append(tr);
   table.append(tbody);result.append(table);
   result.append(el('p','Estado: '+report.status+' · Aprobación: PENDIENTE. Reuniones importadas no son reservas de Calendar en vivo.'));
   const buttons=el('div','');buttons.className='miss-qa-weekly-actions no-print';
   const csv=el('button','Descargar CSV de respaldo');csv.type='button';csv.className='btn secondary';
   csv.onclick=()=>{
     if(!valid())return;const blob=new Blob([missQaWeeklyCsv(report,projects)],{type:'text/csv;charset=utf-8'});
     const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='ADPHOR_Informe_Semanal_'+report.weekStart+'_QA.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
   };
   const pdf=el('button','Imprimir / guardar PDF');pdf.type='button';pdf.className='btn secondary';pdf.onclick=()=>{if(valid())window.print();};
   buttons.append(csv,pdf);result.append(buttons);
   status.textContent='Borrador preparado. Revisa los datos incompletos antes de compartirlo.';
  }catch(error){if(valid())status.textContent=/MFA|Sesión|Permisos|copropiedad|autorizada/i.test(error?.message||'')?error.message:'No se pudo verificar el informe. No se muestran cifras no confirmadas.';}
  finally{if(valid())run.disabled=false;}
 });
}
