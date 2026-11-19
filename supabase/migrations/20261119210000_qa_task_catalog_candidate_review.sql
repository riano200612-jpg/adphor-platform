-- QA Integral ONLY. Proposed recurring administrative duties, not scheduled work.
-- Uses existing verified QA identity + tenant authorization; no seed, cron, mail or Google writes.
BEGIN;
DO $guard$ BEGIN
 IF to_regnamespace('qa_identity_private') IS NULL
    OR to_regclass('public.qa_meeting_events') IS NULL THEN
   RAISE EXCEPTION 'QA-only catalog: verified QA markers are missing';
 END IF;
END $guard$;
CREATE SCHEMA IF NOT EXISTS qa_operational_private;
REVOKE ALL ON SCHEMA qa_operational_private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA qa_operational_private TO authenticated;

CREATE TABLE public.qa_task_catalog_candidates (
 id uuid PRIMARY KEY,
 project_id text NOT NULL REFERENCES public.projects(id) ON DELETE RESTRICT,
 title text NOT NULL CHECK (length(btrim(title)) BETWEEN 3 AND 120),
 description text NOT NULL DEFAULT '' CHECK (length(description) <= 1000),
 cadence text NOT NULL CHECK (cadence IN ('daily','weekly','monthly','quarterly','ad_hoc')),
 status text NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','reviewed_for_design','rejected')),
 created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 reviewed_by uuid NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 review_note text NULL CHECK (review_note IS NULL OR length(btrim(review_note)) BETWEEN 5 AND 1000),
 created_at timestamptz NOT NULL DEFAULT now(),
 reviewed_at timestamptz NULL,
 CONSTRAINT qa_catalog_review_consistency CHECK (
  (status='proposed' AND reviewed_by IS NULL AND review_note IS NULL AND reviewed_at IS NULL)
  OR (status<>'proposed' AND reviewed_by IS NOT NULL AND review_note IS NOT NULL
      AND reviewed_at IS NOT NULL AND reviewed_by<>created_by))
);
CREATE INDEX qa_catalog_project_created_idx ON public.qa_task_catalog_candidates(project_id,created_at DESC,id);
ALTER TABLE public.qa_task_catalog_candidates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.qa_task_catalog_candidates FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.qa_task_catalog_candidates TO authenticated;
CREATE POLICY qa_catalog_manager_read ON public.qa_task_catalog_candidates
 FOR SELECT TO authenticated USING (public.project_role(project_id) IN ('admin','coordinator'));

CREATE TABLE public.qa_task_catalog_events (
 event_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 candidate_id uuid NOT NULL REFERENCES public.qa_task_catalog_candidates(id) ON DELETE RESTRICT,
 project_id text NOT NULL REFERENCES public.projects(id) ON DELETE RESTRICT,
 actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 event_kind text NOT NULL CHECK (event_kind IN ('propose','review_for_design','reject')),
 note text NOT NULL CHECK (length(note)<=1000),
 recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX qa_catalog_events_candidate_idx ON public.qa_task_catalog_events(candidate_id,event_id);
ALTER TABLE public.qa_task_catalog_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.qa_task_catalog_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.qa_task_catalog_events TO authenticated;
CREATE POLICY qa_catalog_events_manager_read ON public.qa_task_catalog_events
 FOR SELECT TO authenticated USING (public.project_role(project_id) IN ('admin','coordinator'));

-- Private definer: append actor/event together; never expose direct table mutations.
CREATE FUNCTION qa_operational_private.task_candidate_command(command text, payload jsonb)
RETURNS public.qa_task_catalog_candidates
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $fn$
DECLARE
 actor uuid := auth.uid();
 record_data public.qa_task_catalog_candidates;
 target uuid;
 target_project text;
 heading text;
 details text;
 frequency text;
 decision text;
 rationale text;
BEGIN
 IF actor IS NULL OR qa_identity_private.current_principal() IS NULL THEN
   RAISE EXCEPTION 'Se requiere sesión QA con MFA AAL2 válido.';
 END IF;
 IF payload IS NULL OR pg_catalog.jsonb_typeof(payload)<>'object' THEN
   RAISE EXCEPTION 'Solicitud de catálogo no válida.';
 END IF;
 target := nullif(payload->>'id','')::uuid;
 IF target IS NULL THEN RAISE EXCEPTION 'Falta el identificador de la propuesta.'; END IF;
 IF command='propose' THEN
   target_project := pg_catalog.btrim(coalesce(payload->>'project_id',''));
   IF coalesce(public.project_role(target_project),'') NOT IN ('admin','coordinator') THEN
     RAISE EXCEPTION 'No puedes proponer actividades para esta copropiedad.';
   END IF;
   heading := pg_catalog.btrim(coalesce(payload->>'title',''));
   details := pg_catalog.btrim(coalesce(payload->>'description',''));
   frequency := coalesce(payload->>'cadence','');
   IF pg_catalog.length(heading) NOT BETWEEN 3 AND 120
     OR pg_catalog.length(details)>1000
     OR frequency NOT IN ('daily','weekly','monthly','quarterly','ad_hoc') THEN
      RAISE EXCEPTION 'Completa título, descripción y periodicidad válidos.';
   END IF;
   INSERT INTO public.qa_task_catalog_candidates
    (id,project_id,title,description,cadence,created_by)
   VALUES(target,target_project,heading,details,frequency,actor)
   ON CONFLICT (id) DO NOTHING RETURNING * INTO record_data;
   IF record_data.id IS NULL THEN
     SELECT * INTO record_data FROM public.qa_task_catalog_candidates WHERE id=target;
     IF record_data.created_by IS DISTINCT FROM actor OR record_data.project_id IS DISTINCT FROM target_project
       OR record_data.title IS DISTINCT FROM heading OR record_data.description IS DISTINCT FROM details
       OR record_data.cadence IS DISTINCT FROM frequency THEN
        RAISE EXCEPTION 'El identificador ya corresponde a otra propuesta.';
     END IF;
     RETURN record_data; -- idempotent retry, no duplicate event
   END IF;
   INSERT INTO public.qa_task_catalog_events(candidate_id,project_id,actor_id,event_kind,note)
    VALUES(target,target_project,actor,'propose','Propuesta registrada; no se programan tareas.');
   RETURN record_data;
 ELSIF command='review' THEN
   SELECT * INTO record_data FROM public.qa_task_catalog_candidates WHERE id=target FOR UPDATE;
   IF record_data.id IS NULL
      OR coalesce(public.project_role(record_data.project_id),'') NOT IN ('admin','coordinator') THEN
     RAISE EXCEPTION 'La propuesta no está disponible para este revisor.';
   END IF;
   IF record_data.created_by=actor THEN
     RAISE EXCEPTION 'Una propuesta necesita revisión de otra persona autorizada.';
   END IF;
   decision := coalesce(payload->>'decision','');
   rationale := pg_catalog.btrim(coalesce(payload->>'note',''));
   IF decision NOT IN ('reviewed_for_design','rejected')
      OR pg_catalog.length(rationale) NOT BETWEEN 5 AND 1000 THEN
     RAISE EXCEPTION 'Selecciona una decisión y justificación de 5 a 1000 caracteres.';
   END IF;
   IF record_data.status<>'proposed' THEN
     IF record_data.status=decision AND record_data.reviewed_by=actor AND record_data.review_note=rationale
       THEN RETURN record_data; END IF;
     RAISE EXCEPTION 'La propuesta ya recibió una decisión. Consulta su historial.';
   END IF;
   UPDATE public.qa_task_catalog_candidates
    SET status=decision,reviewed_by=actor,review_note=rationale,reviewed_at=now()
    WHERE id=target RETURNING * INTO record_data;
   INSERT INTO public.qa_task_catalog_events(candidate_id,project_id,actor_id,event_kind,note)
    VALUES(target,record_data.project_id,actor,
      CASE WHEN decision='rejected' THEN 'reject' ELSE 'review_for_design' END,rationale);
   RETURN record_data;
 END IF;
 RAISE EXCEPTION 'Acción de catálogo no autorizada.';
END;
$fn$;

REVOKE ALL ON FUNCTION qa_operational_private.task_candidate_command(text,jsonb)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION qa_operational_private.task_candidate_command(text,jsonb) TO authenticated;
CREATE FUNCTION public.qa_task_candidate_command(command text,payload jsonb)
RETURNS public.qa_task_catalog_candidates
LANGUAGE sql SECURITY INVOKER SET search_path = ''
AS $fn$ SELECT qa_operational_private.task_candidate_command(command,payload); $fn$;
REVOKE ALL ON FUNCTION public.qa_task_candidate_command(text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.qa_task_candidate_command(text,jsonb) TO authenticated;
COMMENT ON TABLE public.qa_task_catalog_candidates IS
 'QA-only administrative recurring duty proposals; reviewed-for-design is NOT an active schedule.';
COMMENT ON FUNCTION public.qa_task_candidate_command(text,jsonb) IS
 'AAL2 manager-scoped proposals and two-person review, no recurrence activation.';
COMMIT;
