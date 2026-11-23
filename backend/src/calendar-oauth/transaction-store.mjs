// The database connection must use a dedicated server role on the QA database.
// seal/open wrap the payload using authenticated encryption with the state digest
// as associated data. A storage error must abort the authorization flow.
export function createCalendarOAuthTransactionStore({ database, seal, open }) {
  return {
    async save(transaction) {
      const {
        stateDigest, browserNonceDigest, accessSubject, expiresAt, ...payload
      } = transaction;
      const encrypted = await seal(payload, stateDigest);
      await database.query(
        `INSERT INTO calendar_oauth_private.transactions
           (state_digest, browser_nonce_digest, access_subject, expires_at, payload)
         VALUES ($1, $2, $3, $4, $5::jsonb)`,
        [stateDigest, browserNonceDigest, accessSubject, expiresAt, JSON.stringify(encrypted)],
      );
    },
    async consume({ stateDigest, browserNonceDigest, accessSubject, now }) {
      const { rows } = await database.query(
        `DELETE FROM calendar_oauth_private.transactions
          WHERE state_digest = $1 AND browser_nonce_digest = $2
            AND access_subject = $3 AND expires_at > $4
          RETURNING payload`,
        [stateDigest, browserNonceDigest, accessSubject, now],
      );
      return rows.length === 1 ? open(rows[0].payload, stateDigest) : null;
    },
  };
}
