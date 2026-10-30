-- AFTER 01 migration and ONLY in isolated QA. No real tenant data and no real users.
-- '22' is the source/catalog identifier, not a public.projects identifier.
BEGIN;
INSERT INTO public.projects(id,name,type,location,areas,is_demo)
VALUES('porto-castello-qa','Conjunto Residencial Porto Castello — PILOTO SINTÉTICO',
       'Conjunto residencial','',ARRAY['Mantenimiento','Administración','Reuniones','PQRS'],true)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.pilot_daily_reminder_settings(project_id,remind_local_time,enabled)
VALUES('porto-castello-qa',time '17:00',false)
ON CONFLICT(project_id) DO NOTHING;
-- Do not grant membership here; provision separate verified QA Auth users and assign
-- roles via an audited admin flow. A default-deny tenant is intentionally inaccessible.
COMMIT;
