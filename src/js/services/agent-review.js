// Uses the human's Supabase client. RLS validates property membership and admin role.
export async function submitAgentReview(client, {projectId, runId, resultHash, decision, note = ''}) {
  if (!['approved', 'rejected'].includes(decision) || !/^[0-9a-f]{64}$/.test(resultHash) || typeof note !== 'string' || note.length > 4000) {
    throw new Error('La decisión o las observaciones no son válidas.');
  }
  const payload = {project_id: projectId, run_id: runId, result_hash: resultHash, decision, note: note.trim()};
  const {data, error} = await client.from('agent_reviews').insert(payload)
    .select('run_id,project_id,result_hash,decision,note,administrator_id,decided_at').single();
  if (error) {
    if (error.code === '23505') throw new Error('Este borrador ya tiene una decisión. Consulta nuevamente el historial.');
    if (error.code === '42501') throw new Error('Solo el Administrador de esta copropiedad puede registrar la decisión.');
    throw new Error('No se pudo confirmar la decisión. Consulta el historial antes de reintentar.');
  }
  if (!data || data.run_id !== runId || data.project_id !== projectId || data.result_hash !== resultHash || data.decision !== decision || !data.administrator_id || !data.decided_at) {
    throw new Error('No se pudo verificar la decisión. Consulta nuevamente el historial.');
  }
  return data;
}
