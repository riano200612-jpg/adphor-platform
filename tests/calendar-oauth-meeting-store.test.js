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
    assert.deepEqual(await store.claim({actor,idempotencyKey}),{status:'claimed'});
    await store.complete({actor,event:{
      userId:actor.userId,projectId:actor.projectId,idempotencyKey,googleEventId:'event_12345',
      meetLink:'https://meet.google.com/abc-defg-hij',status:'created',
      summary:'QA privada',start:'2026-12-01T15:00:00.000Z',end:'2026-12-01T15:30:00.000Z',
    }});
    const duplicate=await store.claim({actor,idempotencyKey});
    assert.equal(duplicate.status,'complete');
    assert.equal(duplicate.event.googleEventId,'event_12345');
    const rows=await store.list({actor});
    assert.equal(rows.length,1);
    assert.equal(rows[0].meetLink,'https://meet.google.com/abc-defg-hij');
    assert.deepEqual(await store.list({actor:{userId:'other-user',projectId:'source-28'}}),[]);
    const privileges=await database.query(`SELECT
      pg_has_role(current_user,'adphor_qa_calendar_oauth_state','USAGE') AS inherited,
      NOT has_table_privilege(current_user,'calendar_oauth_private.connections','SELECT') AS no_tablewide_select,
      has_column_privilege(current_user,'calendar_oauth_private.connections','payload','SELECT') AS narrow_secret_select,
      NOT has_column_privilege(current_user,'calendar_oauth_private.connections','created_at','SELECT') AS no_extra_column`);
    assert.deepEqual(privileges.rows[0],{inherited:true,no_tablewide_select:true,narrow_secret_select:true,no_extra_column:true});
  }finally{await pg.close();}
});
