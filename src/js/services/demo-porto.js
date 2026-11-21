// Private-browser QA fixture only. This module is NEVER used in Supabase cloud mode.
// It does not emulate server authorization or write to production.
import { assessLocalMeeting } from './demo-meeting-rules.js';
const key = 'adphor.qa.pqrs.demo.v1';
const read = () => {
  try { const value=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(value)?value:[]; }
  catch { return []; }
};
const save = rows => localStorage.setItem(key,JSON.stringify(rows));
export function createDemoPortoRepository() {
  return {
    localDemo:true,
    async list(projectId,status='') {
      return read().filter(x=>x.project_id===projectId && (!status || x.status===status))
        .sort((a,b)=>b.created_at.localeCompare(a.created_at));
    },
    async create(projectId,fields,requestId) {
      const existing=read().find(x=>x.project_id===projectId&&x.request_id===requestId);
      if(existing)return existing;
      if(!['peticion','queja','reclamo','sugerencia'].includes(fields.kind) ||
        String(fields.subject||'').trim().length<3 || String(fields.description||'').trim().length<3) {
        throw Error('Completa el tipo, asunto y descripción.');
      }
      const row={id:crypto.randomUUID(),project_id:projectId,request_id:requestId,
        kind:fields.kind,subject:fields.subject.trim(),description:fields.description.trim(),
        tower:String(fields.tower||'').trim(),apartment:String(fields.apartment||'').trim(),owner:String(fields.owner||'').trim(),priority:'medio',status:'open',assignee:null,solution:'',version:1,
        created_at:new Date().toISOString(),history:[{occurred_at:new Date().toISOString(),old_status:null,new_status:'open'}],
        responses:[]};
      save([row,...read()]);return row;
    },
    async update(projectId,id,version,patch) {
      const rows=read(),i=rows.findIndex(r=>r.id===id&&r.project_id===projectId);
      if(i<0)throw Error('PQRS no encontrada.');const row=rows[i];
      if(row.version!==version)throw Error('El caso cambió. Actualiza la consulta.');
      if(Object.keys(patch).some(k=>!['status','priority','assignee','due_at','solution'].includes(k)))throw Error('Campo inválido.');
      const allowed=['open','assigned','in_progress','resolved','closed'];
      if(patch.status&&!allowed.includes(patch.status))throw Error('Estado inválido.');
      rows[i]={...row,...patch,version:version+1,history:[...row.history,{occurred_at:new Date().toISOString(),old_status:row.status,new_status:patch.status||row.status}]};
      save(rows);return rows[i];
    },
    async history(projectId,id) {const row=read().find(x=>x.id===id&&x.project_id===projectId);if(!row)throw Error('PQRS no encontrada.');return row.history;},
    async respond(projectId,id,body) {if(!String(body).trim())throw Error('Escribe una respuesta.');
      const rows=read(),i=rows.findIndex(x=>x.id===id&&x.project_id===projectId);
      if(i<0)throw Error('PQRS no encontrada.');
      rows[i].responses.push({at:new Date().toISOString(),body:String(body).trim()});save(rows);
      return {ok:true};
    }
  };
}
export async function assessDemoMeeting(projectId,details) {
  if(!projectId)throw Error('Selecciona una copropiedad.');
  return {...assessLocalMeeting(details),'project_id':projectId,persisted:false,notifications_sent:false};
}
