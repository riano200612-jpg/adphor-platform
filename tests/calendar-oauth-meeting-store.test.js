import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {PGlite} from '@electric-sql/pglite';
import {createCalendarOAuthTransactionCipher} from '../backend/src/calendar-oauth/transaction-cipher.mjs';
import {createCalendarOAuthConnectionStore} from '../backend/src/calendar-oauth/connection-store.mjs';
import {createCalendarOAuthConnectionReader} from '../backend/src/calendar-oauth/connection-reader.mjs';
import {createCalendarOAuthMeetingStore} from '../backend/src/calendar-oauth/meeting-store.mjs';

test('proposed private RLS allows only the scoped login to read encrypted connection and persist isolated meetings',async()=>{
  const pg=new PGlite();
  try{
    const sql=async path=>readFile(new URL(path,import.meta.url),'utf8');
    await pg.exec(await sql('../backend/src/calendar-oauth/transactions.sql'));
    await pg.exec(await sql('../docs/qa/calendar-oauth-meetings-rls-proposal.sql'));
    await pg.exec('SET ROLE adphor_qa_calendar_oauth_login');
    const database={
      async query(statement,parameters){return pg.query(statement,parameters);},
      async transaction(callback){
        await pg.exec('BEGIN');
        try{
          const result=await callback({async query(statement,parameters){return pg.query(statement,parameters);}});
          await pg.exec('COMMIT');
          return result;
        }catch(error){await pg.exec('ROLLBACK');throw error;}
      },
    };
    const cipher=await createCalendarOAuthTransactionCipher(crypto.getRandomValues(new Uint8Array(32)));
    const connectionStore=createCalendarOAuthConnectionStore({database,...cipher});
    const actor={userId:'pilot-user',projectId:'source-28'};
    await connectionStore({ ...actor,googleSubject:'google-subject',refreshToken:'synthetic-refresh-token' });
    const reader=createCalendarOAuthConnectionReader({database,open:cipher.open});
    const connection=await reader(actor,async value=>value);
    assert.equal(connection.googleSubject,'google-subject');
    assert.equal(connection.refreshToken,'synthetic-refresh-token');
    assert.equal(await reader({userId:'other-user',projectId:'source-28'},async value=>value),null);

    const store=createCalendarOAuthMeetingStore({database});
    const idempotencyKey='pilot-store-test-request-001';
    const initialClaim=await store.claim({actor,idempotencyKey});
    assert.equal(initialClaim.status,'claimed');
    assert.match(initialClaim.claimGeneration,/^\d{9,14}(?:\.\d{1,6})?$/);
    const eventId='0123456789abcdef0123456789abcdef';
    await store.markAttempted({actor,idempotencyKey,googleEventId:eventId,claimGeneration:initialClaim.claimGeneration,summary:'QA privada',
      start:'2026-12-01T15:00:00.000Z',end:'2026-12-01T15:30:00.000Z'});
    assert.equal((await store.claim({actor,idempotencyKey})).status,'in_progress');
    const intent=await database.transaction(async tx=>{
      await tx.query("SELECT set_config('adphor.calendar_user_id',$1,true),set_config('adphor.calendar_project_id',$2,true)",
        [actor.userId,actor.projectId]);
      return tx.query('SELECT google_event_id,status FROM calendar_oauth_private.meetings WHERE idempotency_key=$1',[idempotencyKey]);
    });
    assert.equal(intent.rows[0].google_event_id,eventId);
    assert.equal(intent.rows[0].status,'creating');
    await store.complete({actor,event:{
      userId:actor.userId,projectId:actor.projectId,idempotencyKey,googleEventId:eventId,
      meetLink:'https://meet.google.com/abc-defg-hij',status:'created',
      summary:'QA privada',start:'2026-12-01T15:00:00.000Z',end:'2026-12-01T15:30:00.000Z',
    }});
    const duplicate=await store.claim({actor,idempotencyKey});
    assert.equal(duplicate.status,'complete');
    assert.equal(duplicate.event.googleEventId,eventId);
    const rows=await store.list({actor});
    assert.equal(rows.length,1);
    assert.equal(rows[0].meetLink,'https://meet.google.com/abc-defg-hij');
    assert.deepEqual(await store.list({actor:{userId:'other-user',projectId:'source-28'}}),[]);
    const pendingKey='pilot-store-meet-pending-002';
    const pendingClaim=await store.claim({actor,idempotencyKey:pendingKey});
    const pendingId='1123456789abcdef0123456789abcdef';
    await store.markAttempted({actor,idempotencyKey:pendingKey,googleEventId:pendingId,claimGeneration:pendingClaim.claimGeneration,summary:'QA Meet pendiente',
      start:'2026-12-02T15:00:00.000Z',end:'2026-12-02T15:30:00.000Z'});
    await store.complete({actor,event:{userId:actor.userId,projectId:actor.projectId,idempotencyKey:pendingKey,
      googleEventId:pendingId,meetLink:null,status:'meet_pending',summary:'QA Meet pendiente',
      start:'2026-12-02T15:00:00.000Z',end:'2026-12-02T15:30:00.000Z'}});
    await database.transaction(async tx=>{
      await tx.query("SELECT set_config('adphor.calendar_user_id',$1,true),set_config('adphor.calendar_project_id',$2,true)",
        [actor.userId,actor.projectId]);
      await tx.query("UPDATE calendar_oauth_private.meetings SET updated_at=CURRENT_TIMESTAMP-interval '2 minutes' WHERE idempotency_key=$1",[pendingKey]);
    });
    assert.equal((await store.claimMeetRefresh({actor,idempotencyKey:pendingKey})).status,'claimed');
    assert.equal((await store.claimMeetRefresh({actor,idempotencyKey:pendingKey})).status,'cooldown');
    const rejectedKey='pilot-store-rejected-003';
    const rejectedClaim=await store.claim({actor,idempotencyKey:rejectedKey});
    const rejectedId='2123456789abcdef0123456789abcdef';
    const rejectedAttempt=await store.markAttempted({actor,idempotencyKey:rejectedKey,googleEventId:rejectedId,claimGeneration:rejectedClaim.claimGeneration,summary:'QA rechazada',
      start:'2026-12-03T15:00:00.000Z',end:'2026-12-03T15:30:00.000Z'});
    await store.failDefinitively({actor,idempotencyKey:rejectedKey,googleEventId:rejectedId,attemptGeneration:rejectedAttempt.attemptGeneration});
    assert.equal((await store.claim({actor,idempotencyKey:rejectedKey})).status,'rejected');
    const rejectedRows=await store.list({actor});
    const rejected=rejectedRows.find(row=>row.idempotencyKey===rejectedKey);
    assert.equal(rejected.status,'failed');
    assert.equal(rejected.googleEventId,null);

    // Simulate an expired DB claim reclaimed while the first request is suspended.
    const staleKey='pilot-store-stale-claim-004';
    const oldClaim=await store.claim({actor,idempotencyKey:staleKey});
    assert.equal(oldClaim.status,'claimed');
    await database.transaction(async tx=>{
      await tx.query("SELECT set_config('adphor.calendar_user_id',$1,true),set_config('adphor.calendar_project_id',$2,true)",
        [actor.userId,actor.projectId]);
      await tx.query("UPDATE calendar_oauth_private.meetings SET updated_at=CURRENT_TIMESTAMP-interval '3 minutes' WHERE idempotency_key=$1",[staleKey]);
    });
    const freshClaim=await store.claim({actor,idempotencyKey:staleKey});
    assert.equal(freshClaim.status,'claimed');
    assert.notEqual(oldClaim.claimGeneration,freshClaim.claimGeneration);
    const staleEvent='3123456789abcdef0123456789abcdef';
    await assert.rejects(store.markAttempted({actor,idempotencyKey:staleKey,googleEventId:staleEvent,
      claimGeneration:oldClaim.claimGeneration,summary:'Solicitud anterior suspendida',
      start:'2026-12-04T15:00:00.000Z',end:'2026-12-04T15:30:00.000Z'}),
      /intent persistence failed/);
    await store.fail({actor,idempotencyKey:staleKey,claimGeneration:oldClaim.claimGeneration});
    assert.equal((await store.claim({actor,idempotencyKey:staleKey})).status,'in_progress');
    const freshAttempt=await store.markAttempted({actor,idempotencyKey:staleKey,googleEventId:staleEvent,
      claimGeneration:freshClaim.claimGeneration,summary:'Solicitud recuperada',
      start:'2026-12-04T15:00:00.000Z',end:'2026-12-04T15:30:00.000Z'});
    assert.match(freshAttempt.attemptGeneration,/^\d{9,14}(?:\.\d{1,6})?$/);
    await store.complete({actor,event:{userId:actor.userId,projectId:actor.projectId,
      idempotencyKey:staleKey,googleEventId:staleEvent,meetLink:null,status:'meet_pending',
      summary:'Solicitud recuperada',start:'2026-12-04T15:00:00.000Z',
      end:'2026-12-04T15:30:00.000Z'}});
    assert.equal((await store.claim({actor,idempotencyKey:staleKey})).status,'complete');

    const privileges=await database.query(`SELECT
      pg_has_role(current_user,'adphor_qa_calendar_oauth_state','USAGE') AS inherited,
      NOT has_table_privilege(current_user,'calendar_oauth_private.connections','SELECT') AS no_tablewide_select,
      has_column_privilege(current_user,'calendar_oauth_private.connections','payload','SELECT') AS narrow_secret_select,
      NOT has_column_privilege(current_user,'calendar_oauth_private.connections','created_at','SELECT') AS no_extra_column`);
    assert.deepEqual(privileges.rows[0],{inherited:true,no_tablewide_select:true,narrow_secret_select:true,no_extra_column:true});
  }finally{await pg.close();}
});
