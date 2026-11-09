-- QA ONLY: qfctnnnnltghepwujpdm. No identities or passwords are embedded.
-- Auth accounts must be created through Supabase Auth, not SQL inserts.
begin;
create schema if not exists qa_identity_private;
revoke all on schema qa_identity_private from public, anon, authenticated;
grant usage on schema qa_identity_private to authenticated, supabase_auth_admin;
create table qa_identity_private.principals (
 email text primary key check (email = lower(trim(email))),
 display_name text not null check (length(display_name) between 1 and 120),
 application_role text not null check (application_role in ('technical_admin','functional_admin_auditor')),
 membership_role text not null check (membership_role in ('admin','coordinator')),
 active boolean not null default true,
 check ((application_role='technical_admin' and membership_role='admin') or
        (application_role='functional_admin_auditor' and membership_role='coordinator'))
);
alter table qa_identity_private.principals enable row level security;
revoke all on qa_identity_private.principals from public, anon, authenticated;

-- Uses a live Auth record, never editable user_metadata or a browser-supplied email.
create function qa_identity_private.current_principal() returns text
language sql stable security definer set search_path='' as $$
 select p.application_role from qa_identity_private.principals p
 join auth.users u on lower(u.email)=p.email
 where u.id=(select auth.uid()) and u.email_confirmed_at is not null
 and p.active and (select auth.jwt()->>'aal')='aal2';
$$;
revoke all on function qa_identity_private.current_principal() from public,anon;
grant execute on function qa_identity_private.current_principal() to authenticated;

create function qa_identity_private.before_user_created(event jsonb) returns jsonb
language sql stable security definer set search_path='' as $$
 select case when exists(select 1 from qa_identity_private.principals
 where email=lower(event->'user'->>'email') and active)
 then '{}'::jsonb else jsonb_build_object('error',jsonb_build_object(
 'http_code',403,'message','El registro está limitado a las identidades autorizadas para QA.')) end;
$$;
revoke all on function qa_identity_private.before_user_created(jsonb) from public,anon,authenticated;
grant execute on function qa_identity_private.before_user_created(jsonb) to supabase_auth_admin;

-- Private provisioning function: administrative execution only, confirmed accounts only.
create function qa_identity_private.provision_confirmed_users() returns integer
language plpgsql security definer set search_path='' as $$
declare item record; provisioned integer:=0;
begin
 for item in select u.id,p.display_name,p.membership_role
 from qa_identity_private.principals p join auth.users u on lower(u.email)=p.email
 where p.active and u.email_confirmed_at is not null loop
  insert into public.profiles(id,name) values(item.id,item.display_name)
  on conflict(id) do update set name=excluded.name;
  insert into public.memberships(project_id,user_id,role)
  select id,item.id,item.membership_role from public.projects
  on conflict(project_id,user_id) do update set role=excluded.role;
  provisioned:=provisioned+1;
 end loop;
 return provisioned;
end;
$$;
revoke all on function qa_identity_private.provision_confirmed_users() from public,anon,authenticated,supabase_auth_admin;

-- Central gates also protect existing SECURITY DEFINER business RPCs.
create or replace function public.project_role(project text) returns text
language sql stable security definer set search_path='' as $$
 select role from public.memberships where project_id=project
 and user_id=(select auth.uid())
 and qa_identity_private.current_principal() is not null;
$$;
create or replace function public.visible_profile(target uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select qa_identity_private.current_principal() is not null and (
 target=(select auth.uid()) or exists(
 select 1 from public.memberships mine join public.memberships theirs using(project_id)
 where mine.user_id=(select auth.uid()) and theirs.user_id=target));
$$;
revoke all on function public.project_role(text),public.visible_profile(uuid) from public,anon;
grant execute on function public.project_role(text),public.visible_profile(uuid) to authenticated;

-- Defense in depth for public tables; Storage policies already call project_role.
-- Do not alter Supabase-managed storage.objects ownership or RLS settings.
do $$ declare tab record; begin
 for tab in select schemaname,tablename from pg_tables
 where schemaname='public' loop
  execute format('alter table %I.%I enable row level security',tab.schemaname,tab.tablename);
  execute format('create policy qa_authorized_mfa on %I.%I as restrictive to authenticated using ((select qa_identity_private.current_principal()) is not null) with check ((select qa_identity_private.current_principal()) is not null)',tab.schemaname,tab.tablename);
 end loop;
end $$;
commit;
