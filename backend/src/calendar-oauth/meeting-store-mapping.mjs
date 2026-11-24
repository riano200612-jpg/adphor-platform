export function eventForRow(row,actor) {
  return {
    userId:actor.userId,projectId:actor.projectId,idempotencyKey:row.idempotency_key,
    googleEventId:row.google_event_id,meetLink:row.meet_url,status:row.status,
    summary:row.summary,start:new Date(row.start_at).toISOString(),end:new Date(row.end_at).toISOString(),
  };
}
