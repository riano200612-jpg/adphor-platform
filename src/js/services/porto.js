// QA-only repository. Authorization remains in PostgreSQL RLS/triggers.
export function portoEnabled(url, enabled, stagingRef) {
  return enabled === 'true' && /^[a-z0-9]{20}$/.test(stagingRef || '') &&
    stagingRef !== 'oqizvirqjwbbhyyjpthq' && url === `https://${stagingRef}.supabase.co`;
}
export function createPortoRepository(client, config) {
  const gate = () => {if (!portoEnabled(config.url,config.enabled,config.stagingRef)) throw Error('Piloto disponible solo en staging aislado.');};
  const checked = r => {if(r.error) throw Error(r.error.message); return r.data;};
  const identity = async () => {gate();const {user}=checked(await client.auth.getUser());if(!user)throw Error('Sesión requerida.');return user.id;};
  const assertProject = async (project) => {
    const actor = await identity();
    if (typeof project !== 'string' || !project.trim()) throw Error('Copropiedad inválida.');
    const result = checked(await client.from('memberships').select('project_id').eq('project_id',project).eq('user_id',actor).limit(1));
    if (!Array.isArray(result) || result.length !== 1) throw Error('Acceso a copropiedad no autorizado.');
    return actor;
  };
  return {
    async listPendingRouteReviews(project) {
      const actor=await assertProject(project);
      const rows=checked(await client.from('qa_pqrs_recipient_review_requests')
        .select('id,project_id,status,requested_by,requested_at,source_reconciled_at')
        .eq('project_id',project).eq('status','PENDING')
        .order('requested_at',{ascending:false}).limit(2));
      if(!Array.isArray(rows)||rows.length>1||rows.some(row=>row.project_id!==project))
        throw Error('La revisión de destinatario presenta información inconsistente.');
      return rows.map(({requested_by,...row})=>({...row,is_mine:requested_by===actor}));
    },
    async requestRouteReview(project) {
      const actor=await assertProject(project);
      const result=await client.from('qa_pqrs_recipient_review_requests')
        .insert({project_id:project,requested_by:actor})
        .select('id,project_id,status,requested_at,source_reconciled_at').single();
      if(result.error?.code==='23505'){
        const existing=await this.listPendingRouteReviews(project);
        if(existing.length===1)return existing[0];
      }
      const row=checked(result);
      if(row?.project_id!==project||row?.status!=='PENDING')
        throw Error('La solicitud de revisión no fue confirmada.');
      return row;
    },
    async decideRouteReview(project,decision) {
      const actor=await assertProject(project);
      if(decision!=='CANCELLED'&&decision!=='REJECTED')
        throw Error('Esta pantalla no autoriza aprobaciones de correo.');
      const requests=await this.listPendingRouteReviews(project);
      if(requests.length!==1)throw Error('No existe una única solicitud pendiente para revisar.');
      const request=requests[0];
      if((decision==='CANCELLED'&&!request.is_mine)||(decision==='REJECTED'&&request.is_mine))
        throw Error('La decisión debe ser confirmada por el administrador correspondiente.');
      const result=checked(await client.from('qa_pqrs_recipient_review_requests')
        .update({status:decision})
        .eq('project_id',project).eq('id',request.id).eq('status','PENDING')
        .select('id,project_id,status,reviewed_at').single());
      if(result?.id!==request.id||result?.project_id!==project||result?.status!==decision||
         !result.reviewed_at)
        throw Error('No se confirmó el cierre de la revisión.');
      return {id:result.id,project_id:result.project_id,status:result.status};
    },
    async routeReadiness(project) {
      await assertProject(project);
      const result=checked(await client.from('qa_pqrs_route_readiness')
        .select('project_id,readiness,issue_code,candidate_email_present,last_reconciled_at')
        .eq('project_id',project).single());
      if(!result||result.project_id!==project)throw Error('Estado de destinatario no corresponde a esta copropiedad.');
      return result;
    },
    async weeklySummary(project,weekStart=null,slaHours=24) {
      await assertProject(project);
      const result=checked(await client.rpc('qa_pqrs_weekly_summary',{
        p_project_id:project,p_week_start:weekStart,p_first_response_sla_hours:slaHours
      }));
      if(result?.project_id!==project||result?.data_source!=='public.pilot_pqrs')
        throw Error('Informe semanal no coincide con la copropiedad.');
      return result;
    },
    async list(project,status='') {
      await assertProject(project);let q=client.from('pilot_pqrs').select('*').eq('project_id',project).order('created_at',{ascending:false}).limit(200);
      if(status)q=q.eq('status',status);return checked(await q);
    },
    async listAttention(project) {
      await assertProject(project);
      const rows = [];
      let cursor;
      while (true) {
        let query = client.from('pilot_pqrs').select('id,project_id,status,due_at')
          .eq('project_id',project).in('status',['open','assigned','in_progress'])
          .order('id',{ascending:true}).limit(200);
        if (cursor) query = query.gt('id',cursor);
        const page = checked(await query);
        if (!page.length) return rows;
        rows.push(...page);
        cursor = page.at(-1).id;
      }
    },
    async create(project,fields,requestId) {
      const actor=await assertProject(project);const payload={project_id:project,created_by:actor,request_id:requestId,kind:fields.kind,subject:fields.subject,description:fields.description};
      const locationFields = ['tower', 'apartment', 'owner'];
      for (const key of locationFields) {
        if (fields[key] !== undefined) payload[key] = fields[key].trim();
      }
      const result=await client.from('pilot_pqrs').insert(payload).select().single();
      if(result.error?.code==='23505'){
        const existing=checked(await client.from('pilot_pqrs').select('*').eq('project_id',project).eq('created_by',actor).eq('request_id',requestId).single());
        if(['kind','subject','description',...locationFields].some(k=>(existing[k]??'')!==(payload[k]??'')))throw Error('Clave de reintento ya utilizada con otro contenido.');
        return existing;
      }return checked(result);
    },
    async update(project,id,version,patch) {
      await assertProject(project);const allowed=['status','priority','assignee','due_at','solution'];
      if(Object.keys(patch).some(k=>!allowed.includes(k)))throw Error('Campo no editable.');
      const rows=checked(await client.from('pilot_pqrs').update(patch).eq('project_id',project).eq('id',id).eq('version',version).select());
      if(rows.length!==1)throw Error('El caso cambió o no tienes permiso. Actualiza la consulta.');return rows[0];
    },
    async history(project,id) {
      await assertProject(project);checked(await client.from('pilot_pqrs').select('id').eq('project_id',project).eq('id',id).single());
      return checked(await client.from('pilot_pqrs_history').select('*').eq('case_id',id).order('version'));
    },
    async responses(project,id) {
      await assertProject(project);
      // Verify the case belongs to the selected QA property before reading its replies.
      checked(await client.from('pilot_pqrs').select('id').eq('project_id',project).eq('id',id).single());
      // One extra row detects truncation instead of pretending to show complete history.
      const rows=checked(await client.from('pilot_pqrs_responses')
        .select('id,case_id,body,created_at').eq('case_id',id)
        .order('created_at',{ascending:true}).order('id',{ascending:true}).limit(201));
      if(!Array.isArray(rows)||rows.length>200||rows.some(row=>row.case_id!==id))
        throw Error('El historial de respuestas es incompleto o inválido. Solicita una revisión.');
      return rows;
    },
    async respond(project,id,body) {
      await assertProject(project);checked(await client.from('pilot_pqrs').select('id').eq('project_id',project).eq('id',id).single());
      return checked(await client.from('pilot_pqrs_responses').insert({case_id:id,body}).select().single());
    }
  };
}
