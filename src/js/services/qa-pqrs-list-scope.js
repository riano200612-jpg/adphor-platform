// Read-only presentation guard for the existing PQRS list.
// Supabase JWT/AAL2/RLS remain the authorization boundary. A browser-side
// guard is defence in depth and MUST NOT be used to grant data access.
const STATUS=Object.freeze(['open','assigned','in_progress','resolved','closed']);
const states=new Set(STATUS);
export function verifyPqrsListScope(rows,projectId,statusFilter=''){
 if(typeof projectId!=='string'||!projectId.trim()||projectId.trim()!==projectId)
   throw Error('No hay una copropiedad válida para consultar PQRS.');
 if(typeof statusFilter!=='string'||(statusFilter!==''&&!states.has(statusFilter)))
   throw Error('El filtro de PQRS no está autorizado.');
 if(!Array.isArray(rows)||rows.length>200)
   throw Error('El listado PQRS no tiene un formato verificable.');
 const seen=new Set();
 for(const row of rows){
   if(!row||typeof row!=='object'||Array.isArray(row)||
      row.project_id!==projectId||typeof row.id!=='string'||
      !row.id.trim()||row.id.trim()!==row.id||seen.has(row.id)||
      !states.has(row.status)||
      (statusFilter!==''&&row.status!==statusFilter)||
      typeof row.subject!=='string'||!row.subject.trim()||
      typeof row.description!=='string')
     throw Error('El listado PQRS contiene un registro ajeno, repetido o incompleto.');
   seen.add(row.id);
 }
 return rows;
}
