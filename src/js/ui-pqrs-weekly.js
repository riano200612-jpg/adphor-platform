// Read-only metrics for actual QA PostgreSQL PQRS. Never expose personal data.
export function normalizeWeeklyPqrs(raw,projectId){
 if(!raw||raw.project_id!==projectId||raw.data_source!=='public.pilot_pqrs'||
    !/^\d{4}-\d{2}-\d{2}$/.test(raw.week_start||''))
   throw Error('Informe semanal no corresponde a esta copropiedad.');
 const numbers=['total','pending','resolved','critical','manager_responded',
  'without_manager_response','late_response','unanswered_over_sla'];
 const safe={projectId,weekStart:raw.week_start,weekEnd:raw.week_end_exclusive,sla:raw.sla_hours};
 for(const k of numbers){
  if(!Number.isSafeInteger(raw[k])||raw[k]<0)throw Error('Cifras semanales inválidas.');
  safe[k]=raw[k];
 }
 for(const k of ['avg_first_response_hours','avg_resolution_hours']){
  safe[k]=raw[k]==null?null:Number(raw[k]);
  if(safe[k]!==null&&(!Number.isFinite(safe[k])||safe[k]<0))throw Error('Tiempo semanal inválido.');
 }
 safe.categories=Array.isArray(raw.categories)?raw.categories.map(c=>{
  if(typeof c?.category!=='string'||c.category.length>100||!Number.isSafeInteger(c.count)||c.count<0)
   throw Error('Categoría semanal inválida.');
  return {name:c.category,count:c.count};
 }):[];
 return safe;
}
const node=(tag,text)=>{const n=document.createElement(tag);n.textContent=String(text);return n;};
export function mountWeeklyPqrs(root,{repository,projectId}){
 root.replaceChildren();
 const details=node('details','');details.className='panel pqrs-weekly-report';details.dataset.pqrsWeekly='';
 details.append(node('summary','Informe semanal de PQRS · Miss ADPHOR'));
 const description=node('p','Informe de los radicados PostgreSQL de la copropiedad seleccionada. No incluye todavía las PQRS históricas del Apps Script. No se muestran datos personales.');description.className='muted';
 const label=node('label','Semana (lunes, opcional): ');
 const week=document.createElement('input');week.type='date';week.setAttribute('aria-label','Fecha lunes del informe');label.append(week);
 const button=node('button','Consultar indicadores');button.type='button';button.className='btn secondary';
 const status=node('p','Consulta bajo demanda; el envío automático semanal aún no está habilitado.');status.setAttribute('role','status');
 const output=node('div','');output.dataset.pqrsWeeklyMetrics='';
 const labels=[['total','PQRS radicadas'],['pending','Pendientes'],['resolved','Resueltas o cerradas'],
 ['critical','Alta prioridad'],['manager_responded','Con respuesta de administrador/coordinador'],
 ['without_manager_response','Sin respuesta de administrador/coordinador'],
 ['late_response','Primera respuesta tardía'],['unanswered_over_sla','Sin respuesta y fuera de plazo']];
 let busy=false;
 button.onclick=async()=>{
  if(busy)return;busy=true;button.disabled=true;status.textContent='Consultando PostgreSQL…';output.replaceChildren();
  try{
   const data=normalizeWeeklyPqrs(await repository.weeklySummary(projectId,week.value||null,24),projectId);
   if(!root.isConnected)return;
   output.append(node('p',`Semana del ${data.weekStart} al ${data.weekEnd} (fin excluido). Plazo de respuesta ${data.sla} h, provisional.`));
   const dl=node('dl','');
   for(const [key,label] of labels)dl.append(node('dt',label),node('dd',data[key]));
   dl.append(node('dt','Tiempo medio primera respuesta'),node('dd',data.avg_first_response_hours==null?'Sin respuesta medible':data.avg_first_response_hours+' h'));
   dl.append(node('dt','Tiempo medio de cierre'),node('dd',data.avg_resolution_hours==null?'Sin cierres medibles':data.avg_resolution_hours+' h'));
   output.append(dl,node('h4','Tipos de PQRS'));
   const list=node('ul','');
   for(const x of data.categories)list.append(node('li',x.name+' · '+x.count));
   if(!data.categories.length)list.append(node('li','Sin radicados en esta semana.'));
   output.append(list,node('p',data.categories.filter(x=>x.count>=3).length?
    'Recurrentes (tres o más): '+data.categories.filter(x=>x.count>=3).map(x=>x.name+' ('+x.count+')').join(', '):
    'Sin categorías recurrentes con tres o más casos.'));
   status.textContent='Datos consultados. No se enviaron correos ni se inició entrenamiento del enjambre.';
  }catch(e){if(root.isConnected)status.textContent='Informe no disponible: '+(e?.message||'acceso denegado');}
  finally{busy=false;if(button.isConnected)button.disabled=false;}
 };
 details.append(description,label,button,status,output);root.append(details);
}
