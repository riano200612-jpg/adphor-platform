import {eventForRow} from './meeting-store-mapping.mjs';

async function scoped(database,actor,callback) {
  if(!actor || typeof actor.userId!=='string' || !actor.userId ||
    typeof actor.projectId!=='string' || !/^[a-z0-9][a-z0-9-]{0,99}$/.test(actor.projectId)) {
    throw new Error('Invalid Calendar meeting scope.');
  }
  return database.transaction(async tx=>{
    await tx.query(`SELECT set_config('adphor.calendar_user_id',$1,true),
                            set_config('adphor.calendar_project_id',$2,true)`,
      [actor.userId,actor.projectId]);
    return callback(tx);
  });
}

export function createCalendarOAuthMeetingStore({database}) {
  if(typeof database?.transaction!=='function')throw new Error('Calendar meeting store is unavailable.');
  return {
    async claim({actor,idempotencyKey}) {
      return scoped(database,actor,async tx=>{
        const inserted=await tx.query(
          `INSERT INTO calendar_oauth_private.meetings (user_id,project_id,idempotency_key,status)
           VALUES ($1,$2,$3,'creating')
           ON CONFLICT (user_id,project_id,idempotency_key) DO UPDATE
             SET status='creating',updated_at=CURRENT_TIMESTAMP
             WHERE (calendar_oauth_private.meetings.status='failed'
                    AND calendar_oauth_private.meetings.google_event_id IS NULL)
                OR (calendar_oauth_private.meetings.status='creating'
                    AND calendar_oauth_private.meetings.updated_at < CURRENT_TIMESTAMP - interval '2 minutes')
           RETURNING idempotency_key,google_event_id`,
          [actor.userId,actor.projectId,idempotencyKey]);
        if(inserted.rows.length===1)return {status:'claimed',googleEventId:inserted.rows[0].google_event_id??null};
        const current=await tx.query(
          `SELECT idempotency_key,google_event_id,meet_url,status,summary,start_at,end_at,updated_at
             FROM calendar_oauth_private.meetings WHERE user_id=$1 AND project_id=$2 AND idempotency_key=$3`,
          [actor.userId,actor.projectId,idempotencyKey]);
        const [row]=current.rows;
        if(row&&['created','meet_pending'].includes(row.status))return {status:'complete',event:eventForRow(row,actor)};
        return {status:'in_progress'};
      });
    },
    async markAttempted({actor,idempotencyKey,googleEventId,summary,start,end}) {
      return scoped(database,actor,async tx=>{
        if(typeof googleEventId!=='string'||!/^[0-9a-f]{32}$/.test(googleEventId))throw new Error('Invalid Google event identity.');
        const {rows}=await tx.query(
          `UPDATE calendar_oauth_private.meetings
              SET google_event_id=$4,summary=$5,start_at=$6::timestamptz,end_at=$7::timestamptz,updated_at=CURRENT_TIMESTAMP
            WHERE user_id=$1 AND project_id=$2 AND idempotency_key=$3 AND status='creating'
              AND (google_event_id IS NULL OR google_event_id=$4)
            RETURNING idempotency_key`,
          [actor.userId,actor.projectId,idempotencyKey,googleEventId,summary,start,end]);
        if(rows.length!==1)throw new Error('Calendar meeting intent persistence failed.');
      });
    },
    async claimMeetRefresh({actor,idempotencyKey}) {
      return scoped(database,actor,async tx=>{
        const claimed=await tx.query(
          `UPDATE calendar_oauth_private.meetings SET updated_at=CURRENT_TIMESTAMP
            WHERE user_id=$1 AND project_id=$2 AND idempotency_key=$3
              AND status='meet_pending' AND google_event_id IS NOT NULL
              AND updated_at < CURRENT_TIMESTAMP - interval '1 minute'
            RETURNING idempotency_key,google_event_id,meet_url,status,summary,start_at,end_at,updated_at`,
          [actor.userId,actor.projectId,idempotencyKey]);
        if(claimed.rows.length===1)return {status:'claimed',event:eventForRow(claimed.rows[0],actor)};
        const current=await tx.query(
          `SELECT idempotency_key,google_event_id,meet_url,status,summary,start_at,end_at,updated_at
             FROM calendar_oauth_private.meetings WHERE user_id=$1 AND project_id=$2 AND idempotency_key=$3`,
          [actor.userId,actor.projectId,idempotencyKey]);
        const [row]=current.rows;
        if(row?.status==='created')return {status:'complete',event:eventForRow(row,actor)};
        if(row?.status==='meet_pending')return {status:'cooldown',event:eventForRow(row,actor)};
        return {status:'missing'};
      });
    },
    async complete({actor,event}) {
      return scoped(database,actor,async tx=>{
        const {rows}=await tx.query(
          `UPDATE calendar_oauth_private.meetings
              SET google_event_id=$4,meet_url=$5,status=$6,summary=$7,
                  start_at=$8::timestamptz,end_at=$9::timestamptz,updated_at=CURRENT_TIMESTAMP
            WHERE user_id=$1 AND project_id=$2 AND idempotency_key=$3
              AND status IN ('creating','meet_pending')
              AND (google_event_id IS NULL OR google_event_id=$4)
            RETURNING idempotency_key`,
          [actor.userId,actor.projectId,event.idempotencyKey,event.googleEventId,event.meetLink,
            event.status,event.summary,event.start,event.end],
        );
        if(rows.length!==1)throw new Error('Calendar meeting persistence failed.');
      });
    },
    async fail({actor,idempotencyKey}) {
      await scoped(database,actor,tx=>tx.query(
        `UPDATE calendar_oauth_private.meetings SET status='failed',updated_at=CURRENT_TIMESTAMP
          WHERE user_id=$1 AND project_id=$2 AND idempotency_key=$3
            AND status='creating' AND google_event_id IS NULL`,
        [actor.userId,actor.projectId,idempotencyKey],
      ));
    },
    async list({actor}) {
      return scoped(database,actor,async tx=>{
        const {rows}=await tx.query(
          `SELECT idempotency_key,google_event_id,meet_url,status,summary,start_at,end_at,updated_at
             FROM calendar_oauth_private.meetings
            WHERE user_id=$1 AND project_id=$2 AND status IN ('created','meet_pending')
            ORDER BY start_at DESC LIMIT 100`,
          [actor.userId,actor.projectId],
        );
        return rows.map(row=>eventForRow(row,actor));
      });
    },
  };
}
