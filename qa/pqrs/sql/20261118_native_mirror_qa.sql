-- QA ONLY: mirrors sanitized native PQRS. Never apply to production or José originals.
GRANT INSERT(project_id,created_by,request_id,kind,subject,description,tower,apartment,owner) ON public.pilot_pqrs TO authenticated;
GRANT UPDATE(status,priority,assignee,due_at,solution) ON public.pilot_pqrs TO authenticated;
GRANT INSERT(case_id,body) ON public.pilot_pqrs_responses TO authenticated;
CREATE OR REPLACE FUNCTION adphor_pqrs_qa.capture_native_pqrs()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE mirror_id uuid;
BEGIN
 IF TG_OP<>'INSERT' OR TG_TABLE_SCHEMA<>'public' OR TG_TABLE_NAME<>'pilot_pqrs' THEN
  RAISE EXCEPTION 'invalid source for PQRS copy' USING ERRCODE='42501';
 END IF;
 INSERT INTO adphor_pqrs_qa.cases(source_system,external_id,project_id,registered_at,category,priority)
 VALUES('qa_native',NEW.id::text,NEW.project_id,NEW.registered_at,
   left(coalesce(nullif(btrim(NEW.kind),''),'Sin clasificar'),100),
   left(coalesce(nullif(btrim(NEW.priority),''),'Sin clasificar'),50))
 ON CONFLICT(source_system,external_id) DO NOTHING RETURNING id INTO mirror_id;
 IF mirror_id IS NULL THEN
   SELECT id INTO mirror_id FROM adphor_pqrs_qa.cases WHERE source_system='qa_native'
   AND external_id=NEW.id::text AND project_id=NEW.project_id;
   IF mirror_id IS NULL THEN RAISE EXCEPTION 'conflicting source mirror' USING ERRCODE='23505'; END IF;
 END IF;
 INSERT INTO adphor_pqrs_qa.notification_outbox(case_id,event_type,state,blocked_reason)
 VALUES(mirror_id,'initial_email','BLOCKED','DESTINATION_NOT_CERTIFIED')
 ON CONFLICT ON CONSTRAINT unique_case_event DO NOTHING;
 RETURN NEW;
END $function$

REVOKE ALL ON FUNCTION adphor_pqrs_qa.capture_native_pqrs() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS adphor_pqrs_qa_native_copy ON public.pilot_pqrs;
CREATE TRIGGER adphor_pqrs_qa_native_copy AFTER INSERT ON public.pilot_pqrs FOR EACH ROW EXECUTE FUNCTION adphor_pqrs_qa.capture_native_pqrs();
