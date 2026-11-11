// Isolated only. The adapter is injected by tests and never wired to the portal.
export function createSimulatedAgenda({calendar, authorize, journal}) {
  const requests = new Map();

  async function run({actor, projectId, eventId, version, requestId, action, start, end, confirmed}) {
    if (!confirmed || !actor?.id || actor.aal !== 'aal2' || !await authorize(actor.id, projectId)) {
      throw Error('Unauthorized');
    }
    if (!projectId || !eventId || !version || !requestId || !['reschedule','cancel'].includes(action)) {
      throw Error('Invalid request');
    }
    if (action === 'reschedule' && !(Number.isFinite(Date.parse(start)) && Date.parse(end) > Date.parse(start))) {
      throw Error('Invalid interval');
    }

    const key = JSON.stringify([projectId, actor.id, requestId]);
    const fingerprint = JSON.stringify([eventId, version, action, start, end]);
    let record = requests.get(key);
    if (record && record.fingerprint !== fingerprint) throw Error('Idempotency conflict');
    if (!record) {
      record = {fingerprint, attempted: false};
      requests.set(key, record);
    }
    if (record.result) return record.result;
    if (record.pending) return record.pending;
    const operationId = key;
    record.pending = execute();
    try {
      return await record.pending;
    } finally {
      record.pending = null;
    }

    async function confirm(event) {
      const result = {state: 'confirmed', eventId, version: event.version, simulated: true};
      if (journal) await journal.confirm(key, result);
      record.result = result;
      return result;
    }

    async function execute() {
      if (journal) {
        const saved = await journal.claim(key, fingerprint);
        if (saved.fingerprint !== fingerprint) throw Error('Idempotency conflict');
        if (saved.result) return saved.result;
        record.attempted = true;
      }
      const event = await calendar.get(projectId, eventId);
      if (!event || event.projectId !== projectId || event.id !== eventId) throw Error('Event unavailable');
      if (record.attempted && event.operationId === operationId) {
        return confirm(event);
      }
      if (event.version !== version || event.status === 'cancelled') throw Error('Version conflict');
      if (action === 'reschedule' && !await calendar.available(projectId, eventId, start, end)) {
        throw Error('Schedule conflict');
      }
      record.attempted = true;
      try {
        const updated = await calendar.update(projectId, eventId, version, {
          ...(action === 'reschedule' ? {start,end} : {status:'cancelled'}), operationId
        });
        if (updated?.id !== eventId || updated.projectId !== projectId ||
            updated.operationId !== operationId || !updated.version) throw Error('Invalid confirmation');
        return await confirm(updated);
      } catch {
        return {state: 'reconcile', eventId, simulated: true};
      }
    }
  }
  return {run};
}
