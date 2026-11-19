-- QA Integral: private and non-activating staging of historical user aliases.
-- The client's Master_ADPHOR remains untouched. No passwords, PINs or roster data.
begin;
create schema if not exists qa_identity_private;
create table if not exists qa_identity_private.legacy_user_candidates (
 legacy_id text primary key check(legacy_id ~ '^[0-9]{1,6}$'),
 username text not null check(username=lower(btrim(username)) and length(username) between 2 and 80),
 display_name text not null check(length(btrim(display_name))>0),
 legacy_role_code text not null check(length(btrim(legacy_role_code))>0),
 legacy_status text not null check(legacy_status in ('Activo','Bloqueado','Desactivado')),
 qa_staff_id text references public.qa_staff_members(id) on delete restrict,
 review_classification text not null check(review_classification in
  ('MATCHED','ALIAS_REVIEW','UNMATCHED','SYSTEM','BLOCKED','DISABLED')),
 auth_user_id uuid unique references auth.users(id) on delete restrict,
 activation_state text not null default 'NOT_INVITED' check
  (activation_state in ('NOT_INVITED','PENDING_REVIEW','INVITED','ACTIVE')),
 source_document text not null default 'Master_ADPHOR/Delegados',
 staged_at timestamptz not null default now(),
 reviewed_at timestamptz,
 constraint legacy_candidates_no_auto_activation
  check(auth_user_id is null or activation_state <> 'NOT_INVITED'),
 constraint legacy_candidates_system_no_staff
  check(review_classification <> 'SYSTEM' or qa_staff_id is null)
);
create unique index if not exists legacy_user_candidates_username_unique
 on qa_identity_private.legacy_user_candidates(lower(username));
alter table qa_identity_private.legacy_user_candidates enable row level security;
revoke all on table qa_identity_private.legacy_user_candidates from public,anon,authenticated;

-- No unauthenticated access or auto-provision. Service-role-only IAM snapshot,
-- verified again against the real active operator and session.
create or replace function public.qa_iam_legacy_review(p_actor uuid,p_session uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $legacy$
declare v_result jsonb;
begin
 if not public.qa_iam_is_operator(p_actor,p_session) then
  raise exception 'IAM_NOT_AUTHORIZED' using errcode='42501';
 end if;
 select jsonb_build_object(
  'total',(select count(*) from qa_identity_private.legacy_user_candidates),
  'candidates',coalesce(jsonb_agg(jsonb_build_object(
   'username',c.username,
   'display_name',c.display_name,
   'legacy_status',c.legacy_status,
   'review_classification',c.review_classification,
   'staff_matched',c.qa_staff_id is not null,
   'auth_linked',c.auth_user_id is not null
  ) order by c.username),'[]'::jsonb)
 ) into v_result
 from (select username,display_name,legacy_status,review_classification,
              qa_staff_id,auth_user_id
       from qa_identity_private.legacy_user_candidates order by username limit 200) c;
 return v_result;
end;
$legacy$;
revoke all on function public.qa_iam_legacy_review(uuid,uuid) from public,anon,authenticated;
grant execute on function public.qa_iam_legacy_review(uuid,uuid) to service_role;
comment on function public.qa_iam_legacy_review(uuid,uuid) is
 'QA-only administrator AAL2 roster review; does not provision Auth users.';
commit;
