// Prueba el contrato REAL de Visitas en QA (qa_visits / qa_create_visit) sobre PGlite.
// Aplica la migración 20261111133108 verbatim. current_principal() se extrae del archivo
// original de principals para no divergir. Auth se simula con claims de sesión.
import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

const U = {
  admin: '00000000-0000-0000-0000-00000000a001',     // principal technical_admin, membership admin p1
  coord: '00000000-0000-0000-0000-00000000c001',     // principal functional_admin_auditor, coordinator p1
  coord2: '00000000-0000-0000-0000-00000000c002',    // coordinator p1 sin principal -> sin acceso
  viewer: '00000000-0000-0000-0000-00000000v001'.replace('v001','b001'), // viewer p1, sin principal
  outsider: '00000000-0000-0000-0000-00000000d001',  // sin membresía
  p2coord: '00000000-0000-0000-0000-00000000e001',   // principal coordinator solo en p2
  inactive: '00000000-0000-0000-0000-00000000f001',  // principal inactivo
  unconfirmed: '00000000-0000-0000-0000-000000000901', // principal sin email confirmado
};
const REQ = '11111111-1111-4111-8111-111111111111';
const WHEN = '2026-11-14T10:00:00-05:00';

let db;
before(async () => {
  db = new PGlite(); await db.waitReady;
  await db.exec(`
    create role anon nologin; create role authenticated nologin;
    create schema auth;
    create table auth.users (id uuid primary key, email text, email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as $$
      select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
    grant usage on schema auth to anon, authenticated;
    grant execute on function auth.uid(), auth.jwt() to anon, authenticated;
    create schema storage;
    create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid);
    alter table storage.objects enable row level security;
  `);
  await db.exec(readFileSync('supabase/migrations/202610190001_workflow.sql', 'utf8'));
  // Esquema de principals, extraído del archivo real (tabla + función current_principal).
  const principals = readFileSync('qa/database/supabase/migrations/20261105144315_qa_authorized_principals.sql', 'utf8');
  const tableStart = principals.indexOf('create schema if not exists qa_identity_private;');
  const tableEnd = principals.indexOf('alter table qa_identity_private.principals enable row level security;');
  const fnStart = principals.indexOf('create function qa_identity_private.current_principal()');
  const fnEnd = principals.indexOf('$$;', fnStart) + 3;
  const revokeEnd = principals.indexOf(';', principals.indexOf('grant execute on function qa_identity_private.current_principal()')) + 1;
  await db.exec(principals.slice(tableStart, tableEnd).replace(/grant usage on schema qa_identity_private to authenticated, supabase_auth_admin;/, 'grant usage on schema qa_identity_private to authenticated;'));
  await db.exec(principals.slice(fnStart, fnEnd));
  await db.exec(principals.slice(fnEnd, revokeEnd));
  await db.exec(readFileSync('supabase/migrations/20261111133108_qa_shared_visits_scheduled_contract.sql', 'utf8'));
  await db.exec(`
    insert into auth.users (id,email,email_confirmed_at) values
      ('${U.admin}','admin@fixture.test',now()),('${U.coord}','coord@fixture.test',now()),
      ('${U.coord2}','coord2@fixture.test',now()),('${U.viewer}','viewer@fixture.test',now()),
      ('${U.outsider}','outsider@fixture.test',now()),('${U.p2coord}','p2@fixture.test',now()),
      ('${U.inactive}','inactive@fixture.test',now()),('${U.unconfirmed}','unconfirmed@fixture.test',null);
    insert into public.profiles (id,name) values
      ('${U.admin}','Admin'),('${U.coord}','Coord'),('${U.coord2}','Coord2'),('${U.viewer}','Viewer'),
      ('${U.outsider}','Outsider'),('${U.p2coord}','P2'),('${U.inactive}','Inactivo'),('${U.unconfirmed}','Sin confirmar');
    insert into public.projects (id,name,areas) values ('p1','Copro 1',array['Zona']),('p2','Copro 2',array['Zona']);
    insert into public.memberships (project_id,user_id,role) values
      ('p1','${U.admin}','admin'),('p1','${U.coord}','coordinator'),('p1','${U.coord2}','coordinator'),
      ('p1','${U.viewer}','viewer'),('p1','${U.inactive}','coordinator'),('p1','${U.unconfirmed}','coordinator'),
      ('p2','${U.p2coord}','coordinator');
    insert into qa_identity_private.principals (email,display_name,application_role,membership_role,active) values
      ('admin@fixture.test','Admin','technical_admin','admin',true),
      ('coord@fixture.test','Coord','functional_admin_auditor','coordinator',true),
      ('p2@fixture.test','P2','functional_admin_auditor','coordinator',true),
      ('inactive@fixture.test','Inactivo','functional_admin_auditor','coordinator',false),
      ('unconfirmed@fixture.test','Sin confirmar','functional_admin_auditor','coordinator',true);
  `);
});
after(async () => { await db.close(); });

async function as(userId, aal, sql, params = []) {
  await db.exec('reset role');
  await db.exec(`select set_config('request.jwt.claim.sub','${userId ?? ''}',false),
                        set_config('request.jwt.claims','${JSON.stringify({sub: userId, aal})}',false)`);
  await db.exec('set role authenticated');
  try { const r = await db.query(sql, params); return {ok: true, rows: r.rows}; }
  catch (err) { return {ok: false, error: err.message, code: err.code}; }
  finally { await db.exec('reset role'); }
}
const rpc = (u, aal = 'aal2', req = REQ, resp = U.coord, motive = 'Inspección', at = WHEN, project = 'p1') =>
  as(u, aal, 'select * from public.qa_create_visit($1,$2,$3,$4,$5)', [project, req, resp, motive, at]);

test('coordinador principal AAL2 registra la visita y devuelve la identidad guardada', async () => {
  const r = await rpc(U.coord);
  assert.equal(r.ok, true, r.error);
  assert.equal(r.rows[0].request_id, REQ);
  assert.equal(r.rows[0].project_id, 'p1');
  assert.equal(r.rows[0].created_by, U.coord);
});

test('reintento idéntico es idempotente: misma fila, sin duplicado', async () => {
  const r = await rpc(U.coord);
  assert.equal(r.ok, true, r.error);
  const n = await as(U.coord, 'aal2', 'select count(*)::int as n from public.qa_visits where request_id=$1', [REQ]);
  assert.equal(n.rows[0].n, 1);
});

test('mismo request_id con otro contenido: 23505', async () => {
  const r = await rpc(U.coord, 'aal2', REQ, U.coord, 'Otro motivo');
  assert.equal(r.ok, false); assert.equal(r.code, '23505');
});

test('otro principal autorizado no puede reclamar un request_id ajeno (23505 por autoría)', async () => {
  // El admin es principal y miembro con rol admin: la autorización pasa; el conflicto lo resuelve la autoría.
  const REQ_OWNED = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  const created = await rpc(U.coord, 'aal2', REQ_OWNED, U.coord, 'Propia del coordinador');
  assert.equal(created.ok, true, created.error);
  const claim = await rpc(U.admin, 'aal2', REQ_OWNED, U.coord, 'Propia del coordinador');
  assert.equal(claim.ok, false);
  assert.equal(claim.code, '23505');
});

test('administrador técnico principal AAL2 puede registrar', async () => {
  const r = await rpc(U.admin, 'aal2', '22222222-2222-4222-8222-222222222222', U.admin);
  assert.equal(r.ok, true, r.error);
});

test('AAL1 no puede registrar aunque sea principal (42501) ni leer (sin filas)', async () => {
  const w = await rpc(U.coord, 'aal1', '33333333-3333-4333-8333-333333333333');
  assert.equal(w.ok, false); assert.equal(w.code, '42501');
  const rd = await as(U.coord, 'aal1', 'select * from public.qa_visits');
  assert.equal(rd.rows.length, 0);
});

test('miembro sin principal (coordinador o visor) no puede registrar ni leer', async () => {
  const w = await rpc(U.coord2, 'aal2', '44444444-4444-4444-8444-444444444444');
  assert.equal(w.ok, false); assert.equal(w.code, '42501');
  const rd = await as(U.coord2, 'aal2', 'select * from public.qa_visits');
  assert.equal(rd.rows.length, 0);
  const v = await rpc(U.viewer, 'aal2', '45454545-4545-4545-8545-454545454545');
  assert.equal(v.ok, false);
});

test('principal inactivo o con email no confirmado queda fuera', async () => {
  const a = await rpc(U.inactive, 'aal2', '55555555-5555-4555-8555-555555555555');
  assert.equal(a.ok, false); assert.equal(a.code, '42501');
  const b = await rpc(U.unconfirmed, 'aal2', '66666666-6666-4666-8666-666666666666');
  assert.equal(b.ok, false); assert.equal(b.code, '42501');
});

test('no miembro no puede registrar ni leer', async () => {
  const w = await rpc(U.outsider, 'aal2', '77777777-7777-4777-8777-777777777777');
  assert.equal(w.ok, false);
  const rd = await as(U.outsider, 'aal2', 'select * from public.qa_visits');
  assert.equal(rd.rows.length, 0);
});

test('aislamiento: principal de p2 no registra en p1 ni ve visitas de p1', async () => {
  const w = await rpc(U.p2coord, 'aal2', '88888888-8888-4888-8888-888888888888', U.coord, 'Cruzada', WHEN, 'p1');
  assert.equal(w.ok, false); assert.equal(w.code, '42501');
  const rd = await as(U.p2coord, 'aal2', 'select * from public.qa_visits where project_id=$1', ['p1']);
  assert.equal(rd.rows.length, 0);
});

test('responsable que no pertenece a la copropiedad es rechazado (FK)', async () => {
  const r = await rpc(U.coord, 'aal2', '99999999-9999-4999-8999-999999999999', U.outsider);
  assert.equal(r.ok, false);
  assert.equal(r.code, '23503');
});

test('motivo vacío o de más de 200 caracteres es rechazado', async () => {
  const empty = await rpc(U.coord, 'aal2', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', U.coord, '   ');
  assert.equal(empty.ok, false); assert.equal(empty.code, '23514');
  const long = await rpc(U.coord, 'aal2', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', U.coord, 'x'.repeat(201));
  assert.equal(long.ok, false); assert.equal(long.code, '23514');
});

test('INSERT directo: solo con created_by propio; no suplantación', async () => {
  const own = await as(U.coord, 'aal2',
    `insert into public.qa_visits(project_id,request_id,responsible_id,motive,scheduled_at,created_by)
     values('p1','cccccccc-cccc-4ccc-8ccc-cccccccccccc','${U.coord}','Directo','${WHEN}','${U.coord}') returning request_id`);
  assert.equal(own.ok, true, own.error);
  const spoof = await as(U.coord, 'aal2',
    `insert into public.qa_visits(project_id,request_id,responsible_id,motive,scheduled_at,created_by)
     values('p1','dddddddd-dddd-4ddd-8ddd-dddddddddddd','${U.coord}','Suplantada','${WHEN}','${U.admin}')`);
  assert.equal(spoof.ok, false);
});

test('update y delete denegados a todos los roles', async () => {
  const up = await as(U.admin, 'aal2', "update public.qa_visits set motive='cambio'");
  assert.equal(up.ok, false);
  const del = await as(U.admin, 'aal2', 'delete from public.qa_visits');
  assert.equal(del.ok, false);
});

test('anon sin privilegios sobre la tabla ni la función', async () => {
  await db.exec('reset role'); await db.exec('set role anon');
  try {
    await assert.rejects(db.query('select * from public.qa_visits'), /permission denied/);
    await assert.rejects(db.query('select * from public.qa_create_visit($1,$2,$3,$4,$5)', ['p1', REQ, U.coord, 'x', WHEN]), /permission denied/);
  } finally { await db.exec('reset role'); }
});

test('la lista devuelve únicamente la copropiedad consultada, en orden estable', async () => {
  const r = await as(U.coord, 'aal2', 'select project_id, request_id, scheduled_at from public.qa_visits where project_id=$1 order by scheduled_at, request_id', ['p1']);
  assert.equal(r.ok, true, r.error);
  assert.ok(r.rows.length >= 1);
  assert.ok(r.rows.every(x => x.project_id === 'p1'));
});
