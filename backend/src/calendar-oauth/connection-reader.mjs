import {digest} from './authorization.mjs';

export function createCalendarOAuthConnectionReader({database,open}) {
  if(typeof database?.transaction!=='function' || typeof open!=='function') {
    throw new Error('Private Calendar connection reader is not configured.');
  }
  return async function withConnection({userId,projectId},callback) {
    if(typeof userId!=='string' || !userId || typeof projectId!=='string' ||
      !/^[a-z0-9][a-z0-9-]{0,99}$/.test(projectId) || typeof callback!=='function') {
      throw new Error('Invalid private Calendar connection scope.');
    }
    return database.transaction(async transaction=>{
      await transaction.query(
        `SELECT set_config('adphor.calendar_user_id',$1,true),
                set_config('adphor.calendar_project_id',$2,true)`,
        [userId,projectId],
      );
      const {rows}=await transaction.query(
        `SELECT google_subject,payload FROM calendar_oauth_private.connections
          WHERE user_id=$1 AND project_id=$2`,
        [userId,projectId],
      );
      if(rows.length!==1) return null;
      const context=await digest(JSON.stringify(['connection',userId,projectId]));
      const secret=await open(rows[0].payload,context);
      if(typeof secret?.refreshToken!=='string' || !secret.refreshToken) {
        throw new Error('Private Calendar connection is invalid.');
      }
      return callback({googleSubject:rows[0].google_subject,refreshToken:secret.refreshToken});
    });
  };
}
