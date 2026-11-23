import {digest} from './authorization.mjs';

export function createCalendarOAuthConnectionStore({database, seal}) {
  return async function saveConnection({userId, projectId, googleSubject, refreshToken}) {
    const context = await digest(JSON.stringify(['connection', userId, projectId]));
    const payload = await seal({refreshToken}, context);
    await database.query(
      `INSERT INTO calendar_oauth_private.connections
         (user_id, project_id, google_subject, payload)
       VALUES ($1, $2, $3, $4::jsonb)`,
      [userId, projectId, googleSubject, JSON.stringify(payload)],
    );
  };
}
