import {digest, randomValue} from './authorization.mjs';

export function createCalendarOAuthPendingStore({database, seal, open}) {
  return {
    async stage({code, transaction, accessSubject}) {
      const nonce = randomValue();
      const pendingDigest = await digest(nonce);
      const {userId, projectId, verifier, nonce: googleNonce, redirectUri} = transaction;
      const payload = await seal({code, verifier, googleNonce, redirectUri}, pendingDigest);
      await database.query(
        `INSERT INTO calendar_oauth_private.pending
           (pending_digest, access_subject, user_id, project_id, payload)
         VALUES ($1, $2, $3, $4, $5::jsonb)`,
        [pendingDigest, accessSubject, userId, projectId, JSON.stringify(payload)],
      );
      return nonce;
    },
    async consume({pendingDigest, accessSubject, userId, projectId}) {
      const {rows} = await database.query(
        `DELETE FROM calendar_oauth_private.pending
          WHERE pending_digest = $1 AND access_subject = $2 AND user_id = $3
            AND project_id = $4 AND expires_at > CURRENT_TIMESTAMP
          RETURNING payload`,
        [pendingDigest, accessSubject, userId, projectId],
      );
      return rows.length === 1 ? open(rows[0].payload, pendingDigest) : null;
    },
  };
}
