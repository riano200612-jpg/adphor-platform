-- Run as database owner. All fixtures and decisions are rolled back.
begin;
select set_config('test.project', project_id, true),
       set_config('test.admin', user_id::text, true)
from public.memberships where role = 'admin' order by project_id limit 1;
select set_config('test.run', gen_random_uuid()::text, true);
insert into public.agent_runs
  (id, project_id, source_read_at, engine_kind, source_snapshot, findings, steps, draft, result_hash)
values (current_setting('test.run')::uuid, current_setting('test.project'), now(),
  'rules', '{}', '[]', '[{},{},{}]', 'Fixture transitoria', repeat('a',64));
do $$ begin
  if has_column_privilege('service_role','public.agent_reviews','decision','INSERT')
     or has_table_privilege('authenticated','public.agent_runs','UPDATE')
     or has_table_privilege('authenticated','public.agent_reviews','DELETE')
     or has_column_privilege('authenticated','public.agent_reviews','administrator_id','INSERT')
     or has_table_privilege('anon','public.agent_runs','SELECT') then
    raise exception 'Unexpected privileges';
  end if;
end $$;
select set_config('request.jwt.claim.sub', gen_random_uuid()::text, true);
set local role authenticated;
do $$ begin
  if exists(select 1 from public.agent_runs where id=current_setting('test.run')::uuid) then
    raise exception 'Cross-property disclosure';
  end if;
  begin
    insert into public.agent_reviews(run_id,project_id,result_hash,decision)
      values(current_setting('test.run')::uuid,current_setting('test.project'),repeat('a',64),'approved');
    raise exception 'Unauthorized approval accepted';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub', current_setting('test.admin'), true);
set local role authenticated;
do $$ begin
  if (select status from public.agent_run_status where id=current_setting('test.run')::uuid)
     is distinct from 'Pendiente de aprobación del administrador' then
    raise exception 'Missing pending state';
  end if;
  begin
    insert into public.agent_reviews(run_id,project_id,result_hash,decision)
      values(current_setting('test.run')::uuid,current_setting('test.project'),repeat('b',64),'approved');
    raise exception 'Wrong hash accepted';
  exception when foreign_key_violation then null; end;
end $$;
insert into public.agent_reviews(run_id,project_id,result_hash,decision)
  values(current_setting('test.run')::uuid,current_setting('test.project'),repeat('a',64),'approved');
do $$ begin
  if not exists (select 1 from public.agent_run_status
    where id=current_setting('test.run')::uuid and status='Aprobado por el administrador'
      and administrator_id=current_setting('test.admin')::uuid and decided_at is not null) then
    raise exception 'Approval was not attributed correctly';
  end if;
  begin
    insert into public.agent_reviews(run_id,project_id,result_hash,decision)
      values(current_setting('test.run')::uuid,current_setting('test.project'),repeat('a',64),'rejected');
    raise exception 'Second decision accepted';
  exception when unique_violation then null; end;
end $$;
reset role;
rollback;
select 'PASS: isolation, permissions, pending state, exact hash, admin attribution, immutable decision; fixtures rolled back' as result;
