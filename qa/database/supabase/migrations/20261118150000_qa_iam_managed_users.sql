-- ADPHOR QA: modelo de empleados gestionados. MIGRACIÓN PREPARADA; NO APLICAR SIN GATE.
-- Base 2026-11-18. No cambia privilegios de administradores existentes.
begin;
create schema if not exists qa_identity_private;
revoke all on schema qa_identity_private from public,anon,authenticated;
grant usage on schema qa_identity_private to service_role,authenticated,supabase_auth_admin;
-- USAGE para authenticated es requerido por las políticas RLS preexistentes;
-- la tabla y funciones administrativas siguen sin grants a ese rol.

create table if not exists qa_identity_private.iam_accounts (
  email text primary key check (email=lower(btrim(email)) and length(email) between 5 and 254),
  user_id uuid unique references auth.users(id) on delete set null,
  display_name text not null check (length(btrim(display_name)) between 1 and 120),
  status text not null check (status in ('inviting','active','suspended','offboarded')),
  invitation_expires_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists qa_identity_private.iam_grants (
  email text not null references qa_identity_private.iam_accounts(email) on delete cascade,
  project_id text not null references public.projects(id),
  role text not null check (role in ('admin','coordinator','technician','viewer')),
  primary key(email,project_id)
);
create table if not exists qa_identity_private.iam_audit (
  event_id bigint generated always as identity primary key,
  request_id uuid not null unique,
  actor_id uuid not null references auth.users(id),
  session_id uuid not null,
  action text not null,
  target_email text not null,
  reason text not null,
  input jsonb not null,
  result jsonb not null,
  occurred_at timestamptz not null default now()
);
alter table qa_identity_private.iam_accounts enable row level security;
alter table qa_identity_private.iam_grants enable row level security;
alter table qa_identity_private.iam_audit enable row level security;
revoke all on qa_identity_private.iam_accounts,qa_identity_private.iam_grants,qa_identity_private.iam_audit from public,anon,authenticated;
grant select,insert,update,delete on qa_identity_private.iam_accounts,qa_identity_private.iam_grants,qa_identity_private.iam_audit to service_role;
grant usage,select on sequence qa_identity_private.iam_audit_event_id_seq to service_role;

-- El JWT se valida primero en el backend. Esta comprobación adicional consulta
-- identidad real y sesión todavía viva, sin depender de user_metadata editable.
create or replace function public.qa_iam_is_operator(p_user uuid,p_session uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists (
   select 1 from auth.users u
   join auth.sessions s on s.user_id=u.id
   join qa_identity_private.principals p on p.email=lower(u.email)
   where u.id=p_user and s.id=p_session and u.email_confirmed_at is not null
     and (u.banned_until is null or u.banned_until<=now())
     and p.active and p.application_role='technical_admin'
 );
$$;
revoke all on function public.qa_iam_is_operator(uuid,uuid) from public,anon,authenticated;
grant execute on function public.qa_iam_is_operator(uuid,uuid) to service_role;

-- El personal invitado puede entrar ÚNICAMENTE tras confirmación, MFA AAL2
-- y vinculación a su edificio. Nunca obtiene rol administrativo general.
create or replace function qa_identity_private.current_principal() returns text
language sql stable security definer set search_path='' as $$
 select case
 when exists (
  select 1 from qa_identity_private.principals p
  where p.email=lower(u.email) and p.active
 ) then (
  select p.application_role from qa_identity_private.principals p where p.email=lower(u.email)
 )
 when exists (
  select 1 from qa_identity_private.iam_accounts m
  where m.email=lower(u.email) and m.user_id=u.id and m.status='active'
 ) then 'managed_staff'
 else null end
 from auth.users u
 where u.id=(select auth.uid()) and u.email_confirmed_at is not null
 and (u.banned_until is null or u.banned_until<=now())
 and (select auth.jwt()->>'aal')='aal2'
 and exists (
  select 1 from auth.sessions s where s.user_id=u.id
  and s.id=(select nullif(auth.jwt()->>'session_id','')::uuid)
 );
$$;
revoke all on function qa_identity_private.current_principal() from public,anon;
grant execute on function qa_identity_private.current_principal() to authenticated;

-- Mantiene bloqueado el autorregistro desconocido y NO abre invitaciones generales.
create or replace function qa_identity_private.before_user_created(event jsonb) returns jsonb
language sql stable security definer set search_path='' as $$
 select case when exists(
  select 1 from qa_identity_private.principals p
  where p.email=lower(event->'user'->>'email') and p.active
 ) or exists (
  select 1 from qa_identity_private.iam_accounts m
  where m.email=lower(event->'user'->>'email') and m.status='inviting'
  and m.invitation_expires_at>now()
 )
 then '{}'::jsonb else jsonb_build_object('error',jsonb_build_object(
   'http_code',403,'message','La creación requiere invitación vigente de ADPHOR.'))
 end;
$$;
revoke all on function qa_identity_private.before_user_created(jsonb) from public,anon,authenticated;
grant execute on function qa_identity_private.before_user_created(jsonb) to supabase_auth_admin;

-- Única superficie RPC de mutación: service_role, con actor global verificado
-- y request_id idempotente. Ningún usuario autenticado puede ejecutarla.
create or replace function public.qa_iam_command(
 p_actor uuid,p_session uuid,p_request uuid,p_action text,p_email text,
 p_name text default '',p_user uuid default null,p_assignments jsonb default '[]'::jsonb,
 p_reason text default ''
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_email text:=lower(btrim(coalesce(p_email,'')));
 v_reason text:=btrim(coalesce(p_reason,''));
 v_record qa_identity_private.iam_accounts%rowtype;
 v_grant jsonb;
 v_id text;
 v_role text;
 v_existing qa_identity_private.iam_audit%rowtype;
 v_input jsonb;
 v_result jsonb;
begin
 if not public.qa_iam_is_operator(p_actor,p_session) then
   raise exception 'IAM_NOT_AUTHORIZED' using errcode='42501';
 end if;
 if p_request is null or length(v_email)>254 or
    v_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
   raise exception 'IAM_INVALID_REQUEST';
 end if;
 if p_action not in ('prepare_invite','link_invite','cancel_invite','grant','suspend','offboard') then
   raise exception 'IAM_INVALID_ACTION';
 end if;
 if length(v_reason)<8 or length(v_reason)>500 then
   raise exception 'IAM_REASON_REQUIRED';
 end if;
 -- El catálogo administrativo no se administra desde el módulo laboral.
 if exists(select 1 from qa_identity_private.principals where email=v_email) then
   raise exception 'IAM_PROTECTED_ADMIN' using errcode='42501';
 end if;
 if p_assignments is null or jsonb_typeof(p_assignments)<>'array' then
   raise exception 'IAM_INVALID_GRANTS';
 end if;
 if p_action in ('prepare_invite','grant') then
   if jsonb_array_length(p_assignments) between 1 and 100 then
     for v_grant in select value from jsonb_array_elements(p_assignments) loop
       v_id:=v_grant->>'project_id'; v_role:=v_grant->>'role';
       if v_id is null or v_role not in ('admin','coordinator','technician','viewer')
          or not exists(select 1 from public.projects where id=v_id) then
         raise exception 'IAM_INVALID_GRANTS';
       end if;
     end loop;
     if (select count(distinct value->>'project_id') from jsonb_array_elements(p_assignments))
        <>jsonb_array_length(p_assignments) then
       raise exception 'IAM_DUPLICATE_GRANTS';
     end if;
   else
     raise exception 'IAM_INVALID_GRANTS';
   end if;
 end if;
 v_input:=jsonb_build_object('action',p_action,'email',v_email,'name',p_name,
   'user',p_user,'assignments',p_assignments,'reason',v_reason);
 select * into v_existing from qa_identity_private.iam_audit
  where request_id=p_request for update;
 if found then
   if v_existing.actor_id<>p_actor or v_existing.input<>v_input then
     raise exception 'IAM_IDEMPOTENCY_CONFLICT';
   end if;
   return v_existing.result;
 end if;
 perform pg_advisory_xact_lock(hashtextextended(v_email,0));
 select * into v_record from qa_identity_private.iam_accounts where email=v_email for update;
 if p_action='prepare_invite' then
   if found then raise exception 'IAM_ALREADY_EXISTS'; end if;
   if length(btrim(p_name)) not between 1 and 120 then raise exception 'IAM_INVALID_NAME'; end if;
   insert into qa_identity_private.iam_accounts(email,display_name,status,invitation_expires_at,created_by)
     values(v_email,btrim(p_name),'inviting',now()+interval '10 minutes',p_actor);
   insert into qa_identity_private.iam_grants(email,project_id,role)
     select v_email,value->>'project_id',value->>'role' from jsonb_array_elements(p_assignments);
 elsif p_action='link_invite' then
   if not found or v_record.status<>'inviting' or
      v_record.invitation_expires_at<=now() or p_user is null or
      not exists(select 1 from auth.users u where u.id=p_user and lower(u.email)=v_email) then
      raise exception 'IAM_INVITE_NOT_LINKABLE';
   end if;
   update qa_identity_private.iam_accounts
    set user_id=p_user,status='active',updated_at=now(),invitation_expires_at=null where email=v_email;
   insert into public.profiles(id,name) values(p_user,v_record.display_name)
    on conflict(id) do update set name=excluded.name;
   insert into public.memberships(project_id,user_id,role)
     select g.project_id,p_user,g.role from qa_identity_private.iam_grants g where g.email=v_email
     on conflict(project_id,user_id) do update set role=excluded.role;
 elsif p_action='cancel_invite' then
   if not found or v_record.status<>'inviting' or v_record.user_id is not null
      then raise exception 'IAM_NOT_CANCELLABLE'; end if;
   delete from qa_identity_private.iam_accounts where email=v_email;
 elsif p_action='grant' then
   if not found or v_record.status<>'active' or v_record.user_id is null
      then raise exception 'IAM_TARGET_NOT_ACTIVE'; end if;
   delete from public.memberships where user_id=v_record.user_id;
   delete from qa_identity_private.iam_grants where email=v_email;
   insert into qa_identity_private.iam_grants(email,project_id,role)
     select v_email,value->>'project_id',value->>'role' from jsonb_array_elements(p_assignments);
   insert into public.memberships(project_id,user_id,role)
     select g.project_id,v_record.user_id,g.role from qa_identity_private.iam_grants g where g.email=v_email;
 elsif p_action in ('suspend','offboard') then
   if not found or v_record.status not in ('active','suspended') or v_record.user_id is null
      then raise exception 'IAM_TARGET_NOT_MANAGED'; end if;
   update qa_identity_private.iam_accounts set status=
     case when p_action='suspend' then 'suspended' else 'offboarded' end,
     updated_at=now() where email=v_email;
   delete from public.memberships where user_id=v_record.user_id;
 end if;
 v_result:=jsonb_build_object('status',
   case when p_action in ('suspend','offboard') then 'restricted_pending_auth_ban' else 'database_applied' end,
   'action',p_action,'email',v_email,'user_id',
   case when p_action='link_invite' then p_user else v_record.user_id end);
 insert into qa_identity_private.iam_audit(request_id,actor_id,session_id,action,target_email,reason,input,result)
 values(p_request,p_actor,p_session,p_action,v_email,v_reason,v_input,v_result);
 return v_result;
end;
$$;
revoke all on function public.qa_iam_command(uuid,uuid,uuid,text,text,text,uuid,jsonb,text) from public,anon,authenticated;
grant execute on function public.qa_iam_command(uuid,uuid,uuid,text,text,text,uuid,jsonb,text) to service_role;

create or replace function public.qa_iam_snapshot(p_actor uuid,p_session uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not public.qa_iam_is_operator(p_actor,p_session) then
   raise exception 'IAM_NOT_AUTHORIZED' using errcode='42501';
 end if;
 return jsonb_build_object(
   'accounts',coalesce((select jsonb_agg(jsonb_build_object('email',m.email,
     'name',m.display_name,'user_id',m.user_id,'status',m.status,
     'assignments',coalesce((select jsonb_agg(jsonb_build_object(
       'project_id',g.project_id,'role',g.role))
       from qa_identity_private.iam_grants g where g.email=m.email),'[]'::jsonb))
     order by m.email) from qa_identity_private.iam_accounts m),'[]'::jsonb),
   'audit',coalesce((select jsonb_agg(jsonb_build_object('action',a.action,
     'target_email',a.target_email,'occurred_at',a.occurred_at,'result',a.result)
     order by a.event_id desc)
     from (select * from qa_identity_private.iam_audit order by event_id desc limit 50) a),'[]'::jsonb)
 );
end;
$$;
revoke all on function public.qa_iam_snapshot(uuid,uuid) from public,anon,authenticated;
grant execute on function public.qa_iam_snapshot(uuid,uuid) to service_role;
commit;
