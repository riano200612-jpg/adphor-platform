-- ADPHOR Gauntlet: auditoría READ-ONLY, segura para ejecutar en QA o producción.
-- NO cambia roles, datos ni configuración.
SELECT p.proname AS function_name,
       pg_get_function_identity_arguments(p.oid) AS arguments,
       p.prosecdef AS security_definer,
       p.proconfig AS function_settings,
       has_function_privilege('anon',p.oid,'EXECUTE') AS anon_can_execute,
       has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_can_execute,
       position('auth.uid()' IN pg_get_functiondef(p.oid))>0 AS mentions_auth_uid,
       position('public.project_role(' IN pg_get_functiondef(p.oid))>0 AS mentions_project_role
FROM pg_proc p
JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public'
  AND p.proname IN ('finalize_monthly_report','monthly_report','project_role','ticket_command','visible_profile')
ORDER BY p.proname;

SELECT tablename,policyname,roles,cmd,qual,with_check
FROM pg_policies
WHERE schemaname='public'
  AND tablename IN ('agent_runs','agent_reviews','tickets','ticket_events','monthly_reports')
ORDER BY tablename,policyname;

SELECT table_name,grantee,privilege_type
FROM information_schema.role_table_grants
WHERE table_schema='public'
  AND table_name IN ('agent_runs','agent_reviews','tickets','ticket_events','monthly_reports')
  AND grantee IN ('anon','authenticated','service_role')
ORDER BY table_name,grantee,privilege_type;

-- Inspeccionar triggers de inmutabilidad y efectos secundarios.
SELECT c.relname AS table_name,t.tgname AS trigger_name,
       pg_get_triggerdef(t.oid) AS definition
FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public'
  AND c.relname IN ('agent_runs','agent_reviews','tickets','ticket_events','monthly_reports')
  AND NOT t.tgisinternal
ORDER BY c.relname,t.tgname;
