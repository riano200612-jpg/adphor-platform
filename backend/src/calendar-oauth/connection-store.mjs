import {digest} from './authorization.mjs';

export function createCalendarOAuthConnectionStore({database,seal}) {
  if(typeof database?.transaction!=='function'||typeof seal!=='function') {
    throw new Error('Private Calendar connection store is not configured.');
  }
  return async function saveConnection({userId,projectId,googleSubject,refreshToken}) {
    if(typeof userId!=='string'||!userId||typeof projectId!=='string'||
      !/^[a-z0-9][a-z0-9-]{0,99}$/.test(projectId)||
      typeof googleSubject!=='string'||!googleSubject||
      typeof refreshToken!=='string'||!refreshToken)throw new Error('Invalid private Calendar connection.');
    const context=await digest(JSON.stringify(['connection',userId,projectId]));
    const payload=await seal({refreshToken},context);
    await database.transaction(async tx=>{
      await tx.query(`SELECT set_config('adphor.calendar_user_id',$1,true),
                            set_config('adphor.calendar_project_id',$2,true)`,[userId,projectId]);
      await tx.query(
        `INSERT INTO calendar_oauth_private.connections
           (user_id,project_id,google_subject,payload)
         VALUES ($1,$2,$3,$4::jsonb)
         ON CONFLICT (user_id,project_id) DO UPDATE
           SET google_subject=EXCLUDED.google_subject,payload=EXCLUDED.payload`,
        [userId,projectId,googleSubject,JSON.stringify(payload)],
      );
    });
  };
}
