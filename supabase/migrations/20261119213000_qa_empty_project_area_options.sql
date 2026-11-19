-- QA Integral: provisional choices only for EMPTY per-property area lists.
-- Original/nonempty area catalogs remain untouched. No tasks are created.
BEGIN;
DO $guard$ BEGIN
 IF to_regnamespace('qa_identity_private') IS NULL OR
    to_regclass('public.qa_task_catalog_candidates') IS NULL OR
    to_regclass('public.qa_meeting_events') IS NULL THEN
  RAISE EXCEPTION 'QA_AREA_SETUP_BLOCKED: isolated QA markers missing';
 END IF;
END $guard$;
UPDATE public.projects
SET areas=ARRAY[
 'Áreas comunes',
 'Portería y seguridad',
 'Agua y tuberías',
 'Electricidad e iluminación',
 'Equipos y ascensores',
 'Piscina y zonas húmedas',
 'Aseo y residuos',
 'Jardines y exteriores',
 'Otra área'
]::text[]
WHERE areas IS NOT NULL AND cardinality(areas)=0;
COMMIT;
