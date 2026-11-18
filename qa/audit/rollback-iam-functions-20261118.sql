-- Original QA identity-gate functions captured from the live database before IAM.
-- Scope: QA qfctnnnnltghepwujpdm. Non-destructive restoration only.
begin;
CREATE OR REPLACE FUNCTION qa_identity_private.before_user_created(event jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select case when exists(select 1 from qa_identity_private.principals
 where email=lower(event->'user'->>'email') and active)
 then '{}'::jsonb else jsonb_build_object('error',jsonb_build_object(
 'http_code',403,'message','El registro está limitado a las identidades autorizadas para QA.')) end;
$function$;

CREATE OR REPLACE FUNCTION qa_identity_private.current_principal()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select p.application_role from qa_identity_private.principals p
 join auth.users u on lower(u.email)=p.email
 where u.id=(select auth.uid()) and u.email_confirmed_at is not null
 and p.active and (select auth.jwt()->>'aal')='aal2';
$function$;
revoke all on function qa_identity_private.current_principal() from public,anon;
grant execute on function qa_identity_private.current_principal() to authenticated;
revoke all on function qa_identity_private.before_user_created(jsonb) from public,anon,authenticated;
grant execute on function qa_identity_private.before_user_created(jsonb) to supabase_auth_admin;
commit;
