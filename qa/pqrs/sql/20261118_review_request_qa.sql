-- ADPHOR QA only. Reproducible snapshot of verified migration; never run against José originals or production.
CREATE TABLE public.qa_pqrs_recipient_review_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 project_id text NOT NULL REFERENCES public.projects(id),
 requested_by uuid NOT NULL DEFAULT auth.uid(),
 source_reconciled_at timestamptz NOT NULL,
 status text NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','APPROVED','REJECTED','CANCELLED')),
 requested_at timestamptz NOT NULL DEFAULT now(),
 reviewed_by uuid,
 reviewed_at timestamptz,
 CONSTRAINT review_status_coherence CHECK(
   (status='PENDING' AND reviewed_by IS NULL AND reviewed_at IS NULL)
   OR (status<>'PENDING' AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL))
);
CREATE UNIQUE INDEX qa_pqrs_review_open_per_project
 ON public.qa_pqrs_recipient_review_requests(project_id) WHERE status='PENDING';
ALTER TABLE public.qa_pqrs_recipient_review_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.qa_pqrs_recipient_review_requests FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.qa_pqrs_recipient_review_requests TO authenticated;
GRANT INSERT(project_id,requested_by) ON public.qa_pqrs_recipient_review_requests TO authenticated;
GRANT SELECT,INSERT,UPDATE ON public.qa_pqrs_recipient_review_requests TO service_role;
CREATE POLICY qa_pqrs_route_review_read ON public.qa_pqrs_recipient_review_requests FOR SELECT TO authenticated
 USING (qa_identity_private.current_principal()='technical_admin'
    AND public.project_role(project_id)='admin');
CREATE POLICY qa_pqrs_route_review_insert ON public.qa_pqrs_recipient_review_requests FOR INSERT TO authenticated
 WITH CHECK (status='PENDING' AND requested_by=(select auth.uid())
    AND qa_identity_private.current_principal()='technical_admin'
    AND public.project_role(project_id)='admin'
    AND EXISTS(SELECT 1 FROM public.qa_pqrs_route_readiness r
       WHERE r.project_id=qa_pqrs_recipient_review_requests.project_id
         AND r.readiness='PENDING_APPROVAL'));
CREATE FUNCTION public.qa_pqrs_route_review_snapshot() RETURNS trigger
 LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $fn$
 DECLARE v_at timestamptz;
 BEGIN
   SELECT r.last_reconciled_at INTO v_at FROM public.qa_pqrs_route_readiness r
    WHERE r.project_id=NEW.project_id AND r.readiness='PENDING_APPROVAL';
   IF v_at IS NULL THEN RAISE EXCEPTION 'Destinatario no habilitado para revisión' USING ERRCODE='42501'; END IF;
   NEW.source_reconciled_at:=v_at;
   RETURN NEW;
 END $fn$;
REVOKE ALL ON FUNCTION public.qa_pqrs_route_review_snapshot() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER qa_pqrs_recipient_review_snapshot
 BEFORE INSERT ON public.qa_pqrs_recipient_review_requests FOR EACH ROW
 EXECUTE FUNCTION public.qa_pqrs_route_review_snapshot();
