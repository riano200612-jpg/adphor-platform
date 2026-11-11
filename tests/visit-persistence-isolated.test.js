import {createIsolatedVisitRepository} from '../qa/isolated-visit-repository.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

test('isolated visit draft persists across role sessions and rejects unauthorized access', async () => {
 const db=new PGlite();
 try {
  await db.exec(`
   create role authenticated;
   create schema auth;
   grant usage on schema auth to authenticated;
   create function auth.uid() returns uuid language sql stable as $$
    select current_setting('request.test_uid')::uuid $$;
   create function auth.jwt() returns jsonb language sql stable as $$
    select jsonb_build_object('aal', current_setting('request.test_aal')) $$;
   create table memberships(project_id text,user_id uuid,role text,primary key(project_id,user_id));
   grant select on memberships to authenticated;
   insert into memberships values ('p1','00000000-0000-0000-0000-000000000001','admin'),
    ('p2','00000000-0000-0000-0000-000000000002','admin');
  `);
  await db.exec(readFileSync(new URL('../qa/visit-persistence-prototype.sql',import.meta.url),'utf8'));
  const session=(id,aal)=>db.exec(`reset role; set role authenticated;
   set request.test_uid = '00000000-0000-0000-0000-00000000000${id}';
   set request.test_aal = '${aal}';`);
  const insert=`insert into visit_drafts (project_id,request_id,responsible_id,motive,scheduled_at) values ('p1','00000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000001','Inspection','2026-11-13 10:00-05')`;
  await session(1,'aal1');
  await assert.rejects(db.exec(insert),/row-level security/);
  await session(2,'aal2');
  await assert.rejects(db.exec(insert),/row-level security/);
  await session(1,'aal2');
  await assert.rejects(db.exec(insert.replace(/000001','Inspection/, "000002','Inspection")),/foreign key/);
  const repository=createIsolatedVisitRepository(db);
  const save=(kind='Inspection')=>repository.save({
   projectId:'p1',requestId:'00000000-0000-0000-0000-000000000003',
   responsibleId:'00000000-0000-0000-0000-000000000001',kind,start:'2026-11-13T10:00'
  });
  const first=await save();
  assert.equal(first.motive,'Inspection');
  assert.deepEqual(await save(),first);
  await assert.rejects(save('Different motive'),/Conflicto de clave/);
  await assert.rejects(db.exec(insert),/duplicate key/);
  await session(2,'aal2');
  assert.equal((await db.query('select * from visit_drafts')).rows.length,0);
  await session(1,'aal2');
  assert.deepEqual(await repository.list('p1'),[first]);
  assert.deepEqual(await save(),first);
 } finally {await db.close();}
});
