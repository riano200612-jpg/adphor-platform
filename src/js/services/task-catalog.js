// ADPHOR QA Integral: proposal-only administrative catalog; no active recurrent jobs.
export const QA_CADENCES=Object.freeze({
 daily:'Diaria',weekly:'Semanal',monthly:'Mensual',
 quarterly:'Trimestral',ad_hoc:'Ocasional'
});
export const QA_CANDIDATE_STATUSES=Object.freeze({
 proposed:'Pendiente de revisión',
 reviewed_for_design:'Revisada para diseño (sin activar)',
 rejected:'Devuelta / rechazada'
});
export function validateTaskCandidate(input){
 const title=String(input?.title??'').trim();
 const description=String(input?.description??'').trim();
 const cadence=String(input?.cadence??'');
 if(title.length<3||title.length>120)throw Error('Título entre 3 y 120 caracteres.');
 if(description.length>1000)throw Error('Descripción máxima de 1000 caracteres.');
 if(!Object.hasOwn(QA_CADENCES,cadence))throw Error('Selecciona una periodicidad propuesta.');
 return {title,description,cadence};
}
export function validateQaCandidateRows(rows,projectId){
 if(!Array.isArray(rows)||!projectId||rows.length>=100)
  throw Error('No se pudo verificar el catálogo completo de esta copropiedad.');
 const unique=new Set();
 for(const r of rows){
  if(r?.project_id!==projectId||typeof r.id!=='string'||!r.id||
     unique.has(r.id)||!Object.hasOwn(QA_CADENCES,r.cadence)||
     !Object.hasOwn(QA_CANDIDATE_STATUSES,r.status)||
     typeof r.title!=='string'||!r.title.trim()||typeof r.created_by!=='string')
   throw Error('La respuesta de propuestas contiene datos no verificables.');
  unique.add(r.id);
 }
 return rows.map(r=>({...r}));
}
