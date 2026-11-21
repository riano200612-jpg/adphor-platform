-- QA Integral ONLY: untrusted document/Drive contributions in quarantine.
-- Original Google Drive files are untouched; no agent indexing, OCR, training or publishing.
BEGIN;
DO $guard$ BEGIN
 IF to_regnamespace('qa_identity_private') IS NULL OR
    to_regclass('public.qa_meeting_events') IS NULL OR
    to_regclass('public.memberships') IS NULL THEN
  RAISE EXCEPTION 'Not the approved isolated ADPHOR QA project';
 END IF;
END $guard$;

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 VALUES('qa-miss-documents','qa-miss-documents',false,15728640,
  ARRAY['application/pdf',
   'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
   'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
 ON CONFLICT(id) DO NOTHING;
-- Fail closed if an existing bucket has different visibility, size or MIME allowlist.
DO $bucket$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id='qa-miss-documents'
   AND public IS FALSE AND file_size_limit=15728640 AND allowed_mime_types = ARRAY[
   'application/pdf',
   'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
   'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']::text[])
 THEN RAISE EXCEPTION 'The Miss ADPHOR bucket does not match QA quarantine safeguards'; END IF;
END $bucket$;

CREATE TABLE public.qa_miss_document_submissions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 project_id text NOT NULL REFERENCES public.projects(id) ON DELETE RESTRICT,
 uploaded_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 source_kind text NOT NULL CHECK (source_kind IN ('drive_link','upload')),
 display_name text NOT NULL CHECK (
  char_length(display_name) BETWEEN 3 AND 180 AND display_name=btrim(display_name)
  AND display_name !~ '[[:cntrl:]<>/\\]'
 ),
 drive_file_id text,
 drive_kind text,
 object_path text,
 media_type text,
 file_bytes bigint,
 sha256 text,
 review_state text NOT NULL DEFAULT 'quarantined'
   CHECK (review_state = 'quarantined'),
 created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT qa_miss_document_source_shape CHECK (
  (source_kind='drive_link' AND drive_file_id ~ '^[A-Za-z0-9_-]{12,150}$'
   AND drive_kind IN ('file','document','spreadsheets','presentation')
   AND object_path IS NULL AND media_type IS NULL AND file_bytes IS NULL AND sha256 IS NULL)
  OR
  (source_kind='upload' AND drive_file_id IS NULL AND drive_kind IS NULL
   AND media_type IN ('application/pdf',
     'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
     'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
   AND file_bytes BETWEEN 1 AND 15728640 AND sha256 ~ '^[a-f0-9]{64}$'
   AND object_path = project_id || '/' || uploaded_by::text || '/' || sha256 || '.' ||
    CASE media_type WHEN 'application/pdf' THEN 'pdf'
      WHEN 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' THEN 'docx'
      WHEN 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' THEN 'xlsx'
      ELSE '' END)
 )
);
CREATE UNIQUE INDEX qa_miss_drive_owner_unique
 ON public.qa_miss_document_submissions(project_id,uploaded_by,drive_file_id)
 WHERE source_kind='drive_link';
CREATE UNIQUE INDEX qa_miss_file_owner_unique
 ON public.qa_miss_document_submissions(project_id,uploaded_by,sha256)
 WHERE source_kind='upload';
CREATE INDEX qa_miss_submissions_owner_created
 ON public.qa_miss_document_submissions(project_id,uploaded_by,created_at DESC);
ALTER TABLE public.qa_miss_document_submissions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.qa_miss_document_submissions FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.qa_miss_document_submissions TO authenticated;

-- An authenticated user may contribute only to their actual assigned building.
-- No self-approval, cross-tenant list, update or delete. AAL2 is mandatory.
CREATE POLICY qa_miss_owner_read ON public.qa_miss_document_submissions
 FOR SELECT TO authenticated USING (
 uploaded_by=(SELECT auth.uid())
 AND (SELECT qa_identity_private.current_principal()) IS NOT NULL
 AND (SELECT auth.jwt()->>'aal')='aal2'
 AND EXISTS(SELECT 1 FROM public.memberships m
   WHERE m.user_id=(SELECT auth.uid()) AND m.project_id=qa_miss_document_submissions.project_id)
);
CREATE POLICY qa_miss_owner_insert ON public.qa_miss_document_submissions
 FOR INSERT TO authenticated WITH CHECK (
 uploaded_by=(SELECT auth.uid()) AND review_state='quarantined'
 AND (SELECT qa_identity_private.current_principal()) IS NOT NULL
 AND (SELECT auth.jwt()->>'aal')='aal2'
 AND EXISTS(SELECT 1 FROM public.memberships m
   WHERE m.user_id=(SELECT auth.uid()) AND m.project_id=qa_miss_document_submissions.project_id)
);
-- Restrictive INSERT also protects against pre-existing permissive Storage policies.
CREATE POLICY qa_miss_objects_insert_fence ON storage.objects AS RESTRICTIVE
 FOR INSERT TO public WITH CHECK (
 bucket_id<>'qa-miss-documents' OR (
 (SELECT qa_identity_private.current_principal()) IS NOT NULL
 AND (SELECT auth.jwt()->>'aal')='aal2'
 AND split_part(name,'/',2)=(SELECT auth.uid())::text
 AND array_length(string_to_array(name,'/'),1)=3
 AND split_part(name,'/',3) ~ '^[a-f0-9]{64}[.](pdf|docx|xlsx)$'
 AND EXISTS(SELECT 1 FROM public.memberships m
  WHERE m.user_id=(SELECT auth.uid()) AND m.project_id=split_part(name,'/',1))
 ));
CREATE POLICY qa_miss_objects_insert ON storage.objects
 FOR INSERT TO authenticated WITH CHECK (
 bucket_id='qa-miss-documents' AND (SELECT qa_identity_private.current_principal()) IS NOT NULL
 AND (SELECT auth.jwt()->>'aal')='aal2'
 AND split_part(name,'/',2)=(SELECT auth.uid())::text
 AND array_length(string_to_array(name,'/'),1)=3
 AND split_part(name,'/',3) ~ '^[a-f0-9]{64}[.](pdf|docx|xlsx)$'
 AND EXISTS(SELECT 1 FROM public.memberships m
  WHERE m.user_id=(SELECT auth.uid()) AND m.project_id=split_part(name,'/',1))
 );
-- Do not allow previews/download/list/edit/delete until separate malware and ACL review.
-- RESTRICTIVE policies override older broad Storage policies for authenticated users.
CREATE POLICY qa_miss_objects_read_fence ON storage.objects AS RESTRICTIVE
 FOR SELECT TO public USING (bucket_id<>'qa-miss-documents');
CREATE POLICY qa_miss_objects_update_fence ON storage.objects AS RESTRICTIVE
 FOR UPDATE TO public USING (bucket_id<>'qa-miss-documents')
 WITH CHECK(bucket_id<>'qa-miss-documents');
CREATE POLICY qa_miss_objects_delete_fence ON storage.objects AS RESTRICTIVE
 FOR DELETE TO public USING (bucket_id<>'qa-miss-documents');
COMMENT ON TABLE public.qa_miss_document_submissions IS
 'QA Miss ADPHOR untrusted private document contributions. Quarantine only: no indexing, AI training, delivery, publishing or Google synchronization.';
COMMIT;
