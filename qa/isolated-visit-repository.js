// QA fixture only. Supply a PGlite connection configured with a synthetic session.
export function createIsolatedVisitRepository(db) {
  return {
    async save({projectId, requestId, responsibleId, kind, start}) {
      const {rows} = await db.query(
        'select * from public.save_visit_draft($1,$2,$3,$4,$5)',
        [projectId, requestId, responsibleId, kind, start + '-05:00']
      );
      return rows[0];
    },
    async list(projectId) {
      const {rows} = await db.query(
        'select * from public.visit_drafts where project_id = $1 order by scheduled_at, request_id',
        [projectId]
      );
      return rows;
    }
  };
}
