// QA user-friendly form choices. Never invent choices in the browser:
// the existing ticket_command validates the selected area against projects.areas.
export const QA_PROVISIONAL_AREAS=Object.freeze([
 'Áreas comunes','Portería y seguridad','Agua y tuberías',
 'Electricidad e iluminación','Equipos y ascensores',
 'Piscina y zonas húmedas','Aseo y residuos',
 'Jardines y exteriores','Otra área'
]);
export function availableProjectAreas(project){
 if(!Array.isArray(project?.areas))return [];
 return [...new Set(project.areas.filter(a=>
   typeof a==='string'&&a.trim()===a&&a.length>0&&a.length<=120
 ))];
}
export function availableAssignees(members,projectId){
 if(!Array.isArray(members)||typeof projectId!=='string')return [];
 const seen=new Set();
 return members.filter(m=>m?.project_id===projectId&&
 ['admin','coordinator','technician'].includes(m.role)&&
 typeof m.user_id==='string'&&m.user_id.trim()&&!seen.has(m.user_id)&&
 (seen.add(m.user_id),true)
 ).map(m=>({id:m.user_id,name:typeof m.name==='string'&&m.name.trim()?m.name:'Colaborador autorizado'}))
 .sort((a,b)=>a.name.localeCompare(b.name,'es'));
}
export function locateFormError(message){
 const s=String(message||'').toLowerCase();
 if(/título|titulo/.test(s))return 'title';
 if(/descripci[oó]n/.test(s))return 'description';
 if(/ubicaci[oó]n/.test(s))return 'location';
 if(/[áa]rea/.test(s))return 'area';
 if(/prioridad/.test(s))return 'priority';
 if(/plazo|fecha/.test(s))return 'due_date';
 if(/responsable/.test(s))return 'assignee';
 if(/foto|archivo|imagen/.test(s))return 'photos';
 return '';
}
