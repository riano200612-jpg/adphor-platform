// QA-only repository. Authorization remains in PostgreSQL RLS/triggers.
export function portoEnabled(url, enabled, stagingRef) {
  return enabled === 'true' && /^[a-z0-9]{20}$/.test(stagingRef || '') &&
    stagingRef !== 'oqizvirqjwbbhyyjpthq' && url === `https://${stagingRef}.supabase.co`;
}
export function createPortoRepository(client, config) {
  const gate = () => {if (!portoEnabled(config.url,config.enabled,config.stagingRef)) throw Error('Piloto disponible solo en staging aislado.');};
  const checked = r => {if(r.error) throw Error(r.error.message); return r.data;};
  const identity = async () => {gate();const {user}=checked(await client.auth.getUser());if(!user)throw Error('Sesión requerida.');return user.id;};
  return {
    async list(project,status='') {
      await identity();let q=client.from('pilot_pqrs').select('*').eq('project_id',project).order('created_at',{ascending:false}).limit(200);
      if(status)q=q.eq('status',status);return checked(await q);
    },
    async create(project,fields,requestId) {
      const actor=await identity();const payload={project_id:project,created_by:actor,request_id:requestId,kind:fields.kind,subject:fields.subject,description:fields.description};
      const result=await client.from('pilot_pqrs').insert(payload).select().single();
      if(result.error?.code==='23505'){
        const existing=checked(await client.from('pilot_pqrs').select('*').eq('project_id',project).eq('created_by',actor).eq('request_id',requestId).single());
        if(['kind','subject','description'].some(k=>existing[k]!==payload[k]))throw Error('Clave de reintento ya utilizada con otro contenido.');
        return existing;
      }return checked(result);
    },
    async update(project,id,version,patch) {
      await identity();const allowed=['status','priority','assignee','due_at','solution'];
      if(Object.keys(patch).some(k=>!allowed.includes(k)))throw Error('Campo no editable.');
      const rows=checked(await client.from('pilot_pqrs').update(patch).eq('project_id',project).eq('id',id).eq('version',version).select());
      if(rows.length!==1)throw Error('El caso cambió o no tienes permiso. Actualiza la consulta.');return rows[0];
    },
    async history(project,id) {
      await identity();checked(await client.from('pilot_pqrs').select('id').eq('project_id',project).eq('id',id).single());
      return checked(await client.from('pilot_pqrs_history').select('*').eq('case_id',id).order('version'));
    },
    async respond(project,id,body) {
      await identity();checked(await client.from('pilot_pqrs').select('id').eq('project_id',project).eq('id',id).single());
      return checked(await client.from('pilot_pqrs_responses').insert({case_id:id,body}).select().single());
    }
  };
}
