// Only called with an isolated PostgreSQL test connection.
export function createIsolatedAgendaJournal(db) {
  return {
    async claim(key, fingerprint) {
      await db.query(
        'insert into isolated_agenda_operations(operation_key,fingerprint) values ($1,$2) on conflict do nothing',
        [key,fingerprint]
      );
      const {rows} = await db.query(
        'select fingerprint,result from isolated_agenda_operations where operation_key=$1', [key]
      );
      return rows[0];
    },
    async confirm(key, result) {
      await db.query(
        'update isolated_agenda_operations set result=$2::jsonb where operation_key=$1 and result is null',
        [key,JSON.stringify(result)]
      );
    }
  };
}
