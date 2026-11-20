// Miss ADPHOR: pure, read-only quality gate for per-property weekly management data.
// It NEVER authorizes queries, users or reports. Server-side RLS/IAM must independently
// restrict data to the caller's verified property set before invoking this presenter.
const FIELDS=Object.freeze({
 tasks:['created','closed','overdue'],
 visits:['created','completed'],
 pqrs:['created','resolved'],
 meetings:['registered']
});
const SOURCE=Object.freeze({
 tasks:'public.tickets',
 visits:'public.qa_visits',
 pqrs:'public.pilot_pqrs',
 meetings:'public.qa_meeting_events'
});
const COL=5*60*60000; // Colombia UTC-05, no daylight saving time.
const DAY=86400000;
const validId=x=>typeof x==='string'&&x.length>0&&x.length<=120&&x.trim()===x&&!/[\x00-\x1f]/.test(x);
const dateUTC=s=>{
 if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s))return NaN;
 const n=Date.parse(s+'T00:00:00.000Z');
 return Number.isFinite(n)&&new Date(n).toISOString().slice(0,10)===s?n:NaN;
};
const metric=(row,key)=>{
 const m=row?.[key];
 if(m===null||m===undefined)return null;
 if(!m||typeof m!=='object'||Array.isArray(m)||m.source!==SOURCE[key])
  throw Error('Origen semanal inválido: '+key);
 const safe={source:SOURCE[key]};
 for(const field of FIELDS[key]){
  if(!Number.isSafeInteger(m[field])||m[field]<0)throw Error('Indicador semanal inválido: '+key);
  safe[field]=m[field];
 }
 return Object.freeze(safe);
};
export function buildMissWeeklyManagementPreview({weekStart,cutoff,authorizedPropertyIds,rows}={}){
 const midnight=dateUTC(weekStart);
 if(!Number.isFinite(midnight)||new Date(midnight).getUTCDay()!==1)
  throw Error('La semana debe comenzar un lunes válido.');
 const start=midnight+COL,end=start+7*DAY;
 const asOf=Date.parse(cutoff);
 if(typeof cutoff!=='string'||!Number.isFinite(asOf)||asOf<start||asOf>end)
  throw Error('Fecha de corte fuera del período.');
 if(!Array.isArray(authorizedPropertyIds)||!authorizedPropertyIds.length||
  authorizedPropertyIds.length>100||authorizedPropertyIds.some(id=>!validId(id))||
  new Set(authorizedPropertyIds).size!==authorizedPropertyIds.length)
  throw Error('Ámbito de copropiedades incompleto o ambiguo.');
 if(!Array.isArray(rows)||rows.length>authorizedPropertyIds.length)
  throw Error('Fuentes de reporte incompletas.');
 const allowed=new Set(authorizedPropertyIds),seen=new Set(),index=new Map();
 for(const row of rows){
  if(!row||!validId(row.project_id)||!allowed.has(row.project_id)||
   seen.has(row.project_id))throw Error('Fuente fuera del alcance autorizado o duplicada.');
  seen.add(row.project_id);index.set(row.project_id,row);
 }
 const coverage={},totals={},properties=[];
 for(const key of Object.keys(FIELDS)){
  coverage[key]=0;
  totals[key]=Object.fromEntries(FIELDS[key].map(field=>[field,0]));
 }
 for(const projectId of authorizedPropertyIds){
  const source=index.get(projectId);
  const metrics={};
  for(const key of Object.keys(FIELDS)){
   metrics[key]=metric(source,key);
   if(metrics[key]){
    coverage[key]++;
    for(const field of FIELDS[key])totals[key][field]+=metrics[key][field];
    for(const field of FIELDS[key])if(!Number.isSafeInteger(totals[key][field]))
     throw Error('Desbordamiento de indicador semanal.');
   }
  }
  // Output never copies extra fields, person identifiers, descriptions or email.
  properties.push(Object.freeze({projectId,metrics:Object.freeze(metrics)}));
 }
 const total=authorizedPropertyIds.length;
 for(const key of Object.keys(FIELDS)){
  if(coverage[key]!==total)totals[key]=null;
  else totals[key]=Object.freeze(totals[key]);
 }
 const complete=Object.values(coverage).every(count=>count===total);
 return Object.freeze({
  kind:'miss-adphor-weekly-management',
  weekStart,weekEndExclusive:new Date(end-COL).toISOString().slice(0,10),
  cutoff:new Date(asOf).toISOString(),
  periodPartial:asOf<end,
  propertyCount:total,coverage:Object.freeze(coverage),
  totals:Object.freeze(totals),properties:Object.freeze(properties),
  status:!complete?'BORRADOR_FUENTES_INCOMPLETAS':asOf<end?'BORRADOR_SEMANA_PARCIAL':'BORRADOR_PARA_REVISION',
  humanApproved:false,exportCertified:false,
  readonly:true,source:'qa-scoped-aggregates'
 });
}
