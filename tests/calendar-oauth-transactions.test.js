import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {PGlite} from '@electric-sql/pglite';
import {QA_URL} from '../qa/security/private-worker-bootstrap-core.mjs';
import {
  consumeCalendarAuthorization, prepareCalendarAuthorization,
} from '../backend/src/calendar-oauth/authorization.mjs';
import {createCalendarOAuthTransactionCipher} from '../backend/src/calendar-oauth/transaction-cipher.mjs';
import {createCalendarOAuthTransactionStore} from '../backend/src/calendar-oauth/transaction-store.mjs';

test('private OAuth state is consumed exactly once by the initiating browser and Access identity', async () => {
  const db = new PGlite();
  try {
    const schema = new URL('../backend/src/calendar-oauth/transactions.sql', import.meta.url);
    await db.exec(await readFile(schema, 'utf8'));
    await db.exec('CREATE ROLE authenticated; SET ROLE authenticated');
    await assert.rejects(db.query('SELECT payload FROM calendar_oauth_private.transactions'), /permission denied/);
    await db.exec('RESET ROLE; SET ROLE adphor_qa_calendar_oauth_state');
    const cipher = await createCalendarOAuthTransactionCipher(crypto.getRandomValues(new Uint8Array(32)));
    const store = createCalendarOAuthTransactionStore({database: db, ...cipher});
    const preparation = await prepareCalendarAuthorization({
      verifiedQaOrigin: QA_URL, clientId: 'test', userId: 'user',
      projectId: 'property', accessSubject: 'access-user', now: 1000,
    });
    await store.save(preparation.transaction);
    const {rows} = await db.query('SELECT payload FROM calendar_oauth_private.transactions');
    assert.doesNotMatch(JSON.stringify(rows), /verifier|projectId/);
    await assert.rejects(
      db.query('UPDATE calendar_oauth_private.transactions SET expires_at = 999999'),
      /permission denied/,
    );
    const input = {
      store, state: new URL(preparation.authorizationUrl).searchParams.get('state'),
      browserNonce: preparation.browserNonce, accessSubject: 'access-user', now: 2000,
    };
    assert.equal(await consumeCalendarAuthorization({...input, state: 'invalid'}), null);
    assert.equal(await consumeCalendarAuthorization({...input, browserNonce: 'A'.repeat(43)}), null);
    assert.equal(await consumeCalendarAuthorization({...input, accessSubject: 'other'}), null);
    assert.equal(await consumeCalendarAuthorization({...input, now: 301000}), null);
    const results = await Promise.all([consumeCalendarAuthorization(input), consumeCalendarAuthorization(input)]);
    assert.equal(results.filter(result => result === null).length, 1);
    assert.equal(results.find(Boolean).verifier, preparation.transaction.verifier);
    assert.equal(results.find(Boolean).projectId, 'property');
    assert.equal(await consumeCalendarAuthorization(input), null);
  } finally {
    await db.close();
  }
});

test('OAuth transaction ciphertext fails closed on replay under a different context or key and on tampering', async () => {
  const key = crypto.getRandomValues(new Uint8Array(32));
  const cipher = await createCalendarOAuthTransactionCipher(key);
  const other = await createCalendarOAuthTransactionCipher(crypto.getRandomValues(new Uint8Array(32)));
  const stateDigest = 'A'.repeat(43);
  const payload = {verifier: 'synthetic'};
  const first = await cipher.seal(payload, stateDigest);
  const second = await cipher.seal(payload, stateDigest);
  assert.notEqual(first.iv, second.iv);
  assert.deepEqual(await cipher.open(first, stateDigest), payload);
  await assert.rejects(cipher.open(first, 'B'.repeat(43)));
  await assert.rejects(other.open(first, stateDigest));
  const changed = (first.ciphertext[0] === 'A' ? 'B' : 'A') + first.ciphertext.slice(1);
  await assert.rejects(cipher.open({...first, ciphertext: changed}, stateDigest));
  await assert.rejects(cipher.open({...first, version: 0}, stateDigest));
  await assert.rejects(createCalendarOAuthTransactionCipher(new Uint8Array(16)));
});
