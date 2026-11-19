-- QA Integral: bind a validated legacy username ONLY to a managed invited Auth identity.
-- Master_ADPHOR remains read-only. This does not create Auth users or enable username login.
begin;
create or replace function public.qa_iam_legacy_eligible(
 p_actor uuid,p_session uuid,p_alias text,p_name text
) returns boolean language plpgsql stable security definer set search_path='' as $fn$
declare v_alias text:=lower(btrim(coalesce(p_alias,'')));
begin
 if not public.qa_iam_is_operator(p_actor,p_session) then
  raise exception 'IAM_NOT_AUTHORIZED' using errcode='42501';
 end if;
 if length(v_alias) not between 2 and 80 or v_alias !~ '^[a-z0-9._-]+$'
    or length(btrim(coalesce(p_name,''))) not between 1 and 120 then
   return false;
 end if;
 return exists(
  select 1 from qa_identity_private.legacy_user_candidates c
  join public.qa_staff_members s on s.id=c.qa_staff_id
  where c.username=v_alias and c.display_name=btrim(p_name)
   and lower(btrim(s.name))=lower(btrim(c.display_name))
   and c.legacy_status='Activo' and c.review_classification='MATCHED'
   and c.activation_state='NOT_INVITED' and c.auth_user_id is null and s.active
 );
end;
$fn$;
revoke all on function public.qa_iam_legacy_eligible(uuid,uuid,text,text)
 from public,anon,authenticated;
grant execute on function public.qa_iam_legacy_eligible(uuid,uuid,text,text)
 to service_role;

create or replace function public.qa_iam_legacy_link_invite(
 p_actor uuid,p_session uuid,p_request uuid,p_alias text,p_email text,
 p_user uuid,p_name text,p_reason text
) returns jsonb language plpgsql security definer set search_path='' as $fn$
declare
 v_alias text:=lower(btrim(coalesce(p_alias,'')));
 v_email text:=lower(btrim(coalesce(p_email,'')));
 v_reason text:=btrim(coalesce(p_reason,''));
 v_candidate qa_identity_private.legacy_user_candidates%rowtype;
 v_managed qa_identity_private.iam_accounts%rowtype;
 v_previous qa_identity_private.iam_audit%rowtype;
 v_input jsonb;
 v_result jsonb;
begin
 if not public.qa_iam_is_operator(p_actor,p_session) then
  raise exception 'IAM_NOT_AUTHORIZED' using errcode='42501';
 end if;
 if p_request is null or p_user is null
    or v_alias !~ '^[a-z0-9._-]{2,80}$'
    or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
    or length(v_email)>254 or length(v_reason) not between 8 and 500
    or length(btrim(coalesce(p_name,''))) not between 1 and 120 then
  raise exception 'IAM_LEGACY_INVALID_INPUT';
 end if;
 v_input:=jsonb_build_object('action','link_legacy_alias','alias',v_alias,
   'email',v_email,'user',p_user,'name',btrim(p_name),'reason',v_reason);
 select * into v_previous from qa_identity_private.iam_audit
 where request_id=p_request for update;
 if found then
  if v_previous.actor_id<>p_actor or v_previous.input<>v_input then
   raise exception 'IAM_IDEMPOTENCY_CONFLICT';
  end if;
  return v_previous.result;
 end if;
 select * into v_candidate from qa_identity_private.legacy_user_candidates
  where username=v_alias for update;
 if not found or v_candidate.auth_user_id is not null
    or v_candidate.activation_state<>'NOT_INVITED'
    or v_candidate.legacy_status<>'Activo'
    or v_candidate.review_classification<>'MATCHED'
    or v_candidate.qa_staff_id is null
    or v_candidate.display_name<>btrim(p_name)
    or not exists(select 1 from public.qa_staff_members s
                  where s.id=v_candidate.qa_staff_id and s.active
                    and lower(btrim(s.name))=lower(btrim(v_candidate.display_name)))
 then
  raise exception 'IAM_LEGACY_NOT_ELIGIBLE' using errcode='42501';
 end if;
 if exists(select 1 from qa_identity_private.principals where email=v_email) then
  raise exception 'IAM_PROTECTED_ADMIN' using errcode='42501';
 end if;
 select * into v_managed from qa_identity_private.iam_accounts
  where email=v_email for share;
 if not found or v_managed.status<>'active' or v_managed.user_id<>p_user
    or v_managed.display_name<>v_candidate.display_name then
  raise exception 'IAM_LEGACY_ACCOUNT_MISMATCH' using errcode='42501';
 end if;
 if not exists(select 1 from auth.users u where u.id=p_user
              and lower(u.email)=v_email
              and (u.banned_until is null or u.banned_until<=now())) then
  raise exception 'IAM_LEGACY_AUTH_MISMATCH' using errcode='42501';
 end if;
 -- Unique auth_user_id enforces one person/one alias. Invitation is NOT full activation.
 update qa_identity_private.legacy_user_candidates
  set auth_user_id=p_user,activation_state='INVITED',reviewed_at=now()
  where legacy_id=v_candidate.legacy_id;
 v_result:=jsonb_build_object('status','legacy_invited','alias',v_alias,
  'email',v_email,'auth_linked',true,'active',false);
 insert into qa_identity_private.iam_audit
  (request_id,actor_id,session_id,action,target_email,reason,input,result)
 values(p_request,p_actor,p_session,'link_legacy_alias',v_email,v_reason,v_input,v_result);
 return v_result;
end;
$fn$;
revoke all on function public.qa_iam_legacy_link_invite(uuid,uuid,uuid,text,text,uuid,text,text)
 from public,anon,authenticated;
grant execute on function public.qa_iam_legacy_link_invite(uuid,uuid,uuid,text,text,uuid,text,text)
 to service_role;
comment on function public.qa_iam_legacy_link_invite(uuid,uuid,uuid,text,text,uuid,text,text) is
 'QA-only: AAL2 administrator links one active reconciled alias to the already invited Auth user; never activates login.';
commit;
