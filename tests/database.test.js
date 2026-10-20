import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

test('PostgreSQL: enforce isolation, actor identity, evidence, transitions and concurrency', async () => {
  const db = new PGlite();
  try {
    // Minimal Supabase Auth/Storage contracts; real RLS and RPCs run in PostgreSQL.
    await db.exec(`create role anon; create role authenticated;
      create schema auth; create schema storage;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth,storage to authenticated;
      grant execute on function auth.uid() to authenticated;
      create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id serial primary key,bucket_id text,name text);
      alter table storage.objects enable row level security;
      grant select,insert on storage.objects to authenticated;
      grant usage on sequence storage.objects_id_seq to authenticated;`);
    await db.exec(await readFile(new URL('../supabase/migrations/202610190001_workflow.sql',import.meta.url),'utf8'));
    const boss='00000000-0000-4000-8000-000000000001', tech='00000000-0000-4000-8000-000000000002', outsider='00000000-0000-4000-8000-000000000003', viewer='00000000-0000-4000-8000-000000000004';
    const id='10000000-0000-4000-8000-000000000001';
    await db.exec(`insert into auth.users values('${boss}'),('${tech}'),('${outsider}'),('${viewer}');
      insert into public.profiles values('${boss}','Coordinador'),('${tech}','Técnico'),('${outsider}','Otra copropiedad'),('${viewer}','Consulta');
      insert into public.projects(id,name,areas) values('one','Uno',array['Piscina']),('two','Dos',array['Piscina']);
      insert into public.memberships values('one','${boss}','coordinator'),('one','${tech}','technician'),('two','${outsider}','coordinator'),('one','${viewer}','viewer');`);
    const asUser=async user=>{await db.exec(`reset role; set role authenticated; set request.jwt.claim.sub='${user}';`);};
    const command=async (action,payload)=> (await db.query('select to_jsonb(public.ticket_command($1,$2::jsonb)) as ticket',[action,JSON.stringify(payload)])).rows[0].ticket;
    const input={id,project_id:'one',title:'Fuga',description:'Fuga en tubería',location:'Cuarto de máquinas',area:'Piscina',priority:'Alta',assignee:tech,due_date:'2099-12-01',evidence:[]};
    await asUser(boss);
    let row=await command('create',input); assert.equal(row.status,'Pendiente');
    assert.equal((await command('create',input)).id,id);
    await assert.rejects(()=>db.exec(`update public.tickets set status='Cerrada'`),/permission denied/);
    await assert.rejects(()=>db.exec(`update public.memberships set role='admin'`),/permission denied/);
    await asUser(outsider);
    assert.equal((await db.query('select * from public.tickets')).rows.length,0);
    assert.equal((await db.query('select * from public.projects')).rows.length,1);
    await assert.rejects(()=>command('start',{id,version:1}),/permiso/);
    await assert.rejects(()=>command('create',{...input,id:'10000000-0000-4000-8000-000000000002'}),/permiso/);
    await asUser(viewer);
    await assert.rejects(()=>command('start',{id,version:1}),/permiso/);
    await asUser(tech);
    await assert.rejects(()=>command('create',{...input,id:'10000000-0000-4000-8000-000000000003',assignee:boss}),/coordinador/);
    row=await command('start',{id,version:1}); assert.equal(row.status,'En proceso');
    await assert.rejects(()=>command('submit',{id,version:2,note:'Reparado',evidence:[]}),/evidencia/);
    await assert.rejects(()=>command('submit',{id,version:2,note:'Reparado',evidence:[{name:'x',path:'untrusted'}]}),/evidencia/);
    const path=`one/${tech}/${id}/evidence.png`;
    await db.query('insert into storage.objects(bucket_id,name) values($1,$2)',['evidence',path]);
    await assert.rejects(()=>db.query('insert into storage.objects(bucket_id,name) values($1,$2)',['evidence',`two/${tech}/${id}/evidence.png`]),/row-level security/);
    row=await command('submit',{id,version:2,note:'Reparado',evidence:[{name:'Foto',path}]});
    assert.equal(row.status,'Por verificar');
    await assert.rejects(()=>command('close',{id,version:3,note:'Verificado'}),/coordinador/);
    await asUser(boss);
    await assert.rejects(()=>command('close',{id,version:2,note:'Verificado'}),/actualizó/);
    await assert.rejects(()=>command('close',{id,version:3,note:''}),/Describe/);
    row=await command('close',{id,version:3,note:'Prueba satisfactoria',actor:'Falso',history:[]});
    assert.equal(row.status,'Cerrada'); assert.equal(row.history.length,4); assert.equal(row.history.at(-1).actor,'Coordinador');
    row=await command('reopen',{id,version:4,note:'Fuga recurrente'}); assert.equal(row.status,'En proceso');
    await asUser(outsider); assert.equal((await db.query('select * from storage.objects')).rows.length,0);
    await db.exec('reset role; set role anon;');
    await assert.rejects(()=>db.exec('select * from public.tickets'),/permission denied/);
    await assert.rejects(()=>command('close',{id,version:5,note:'Falso'}),/permission denied/);
    await db.exec(`reset role; alter table auth.users add column email text;
      insert into auth.users(id,email) values('00000000-0000-4000-8000-000000000005','demo-adphor@example.invalid');`);
    const seed=await readFile(new URL('../supabase/demo-owner.sql',import.meta.url),'utf8');
    await db.exec(seed);
    await db.exec(seed);
    await asUser('00000000-0000-4000-8000-000000000005');
    const demoProjects=(await db.query('select * from public.projects')).rows;
    assert.equal(demoProjects.length,16);
    assert.ok(demoProjects.every(p=>p.is_demo));
    assert.equal((await db.query('select * from public.tickets')).rows.length,64);
    await assert.rejects(()=>command('start',{id,version:5}),/permiso/);
    await asUser(outsider);
    assert.equal((await db.query('select * from public.projects')).rows.length,1);
    await db.exec('reset role;');
    await db.exec(await readFile(new URL('../supabase/migrations/202610200002_monthly_reporting.sql',import.meta.url),'utf8'));
    await db.exec(`insert into public.tickets(id,project_id,title,description,location,area,priority,assignee,due_date,status,created_by,created_at,history)
      values('20000000-0000-4000-8000-000000000001','one','Histórico','Prueba','Zona','Piscina','Media','${boss}','2025-09-15','En proceso','${boss}','2025-08-10T12:00:00Z',
      '[{"action":"create","at":"2025-08-10T12:00:00Z","status":"Pendiente","due_date":"2025-09-15"},{"action":"close","at":"2025-09-10T12:00:00Z","status":"Cerrada"},{"action":"reopen","at":"2025-10-01T05:00:00Z","status":"En proceso"}]');`);
    await asUser(boss);
    const monthly=async(project,month,finalize=false)=>(await db.query(`select public.${finalize?'finalize_monthly_report':'monthly_report'}($1,$2::date) as report`,[project,month])).rows[0].report;
    const september=await monthly('one','2025-09-01');
    assert.equal(september.opening,1); assert.equal(september.ending,0);
    assert.equal(september.created,0); assert.equal(september.closure_events,1);
    assert.equal(september.trend.at(-1).closures,1);
    const october=await monthly('one','2025-10-01');
    assert.equal(october.opening,0); assert.equal(october.ending,1); assert.equal(october.reopened,1);
    const frozen=await monthly('one','2025-09-01',true); assert.equal(frozen.frozen,true);
    assert.equal((await monthly('one','2025-09-01',true)).finalized_at,frozen.finalized_at);
    await assert.rejects(()=>db.exec("update public.monthly_reports set content='{}'"),/permission denied/);
    await asUser(viewer); await assert.rejects(()=>monthly('one','2025-08-01',true),/Solo/);
    await asUser(outsider); await assert.rejects(()=>monthly('one','2025-09-01'),/acceso/);
    await asUser('00000000-0000-4000-8000-000000000005');
    await assert.rejects(()=>monthly('demo-adphor-01','2025-09-01',true),/demostración/);
    await db.exec('reset role;');
    await assert.rejects(()=>db.exec("update public.tickets set history='[]' where id='20000000-0000-4000-8000-000000000001'"),/acumulativo/);
    await db.exec(`insert into public.tickets(id,project_id,title,description,location,area,priority,assignee,due_date,status,created_by,created_at,history)
      select md5('load:'||n)::uuid,'two','Carga','Registro sintético','Zona','Piscina','Media','${outsider}','2025-09-30','Pendiente','${outsider}','2025-09-01T05:00:00Z',
      '[{"action":"create","at":"2025-09-01T05:00:00Z","status":"Pendiente","due_date":"2025-09-30"}]'::jsonb from generate_series(1,10000) n;`);
    await asUser(outsider);
    const started=performance.now(); const bulk=await monthly('two','2025-09-01');
    assert.equal(bulk.created,10000); assert.equal(bulk.ending,10000);
    console.log(`Informe de 10.000 casos sintéticos en PostgreSQL local: ${Math.round(performance.now()-started)} ms`);

  } finally { await db.close(); }
});
