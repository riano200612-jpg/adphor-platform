export function eventForRow(row,actor) {
  return {
    userId:actor.userId,projectId:actor.projectId,idempotencyKey:row.idempotency_key,
    googleEventId:row.status==='failed'?null:row.google_event_id,meetLink:row.status==='failed'?null:row.meet_url,status:row.status==='creating'?'reconciling':row.status,
    summary:row.summary,start:new Date(row.start_at).toISOString(),end:new Date(row.end_at).toISOString(),
    updatedAt:row.updated_at?new Date(row.updated_at).toISOString():null,
  };
}
