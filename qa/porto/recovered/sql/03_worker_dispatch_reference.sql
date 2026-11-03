-- QA reference for a trusted server-side scheduler. Do not execute in production.
-- Supabase pg_cron every minute (or dedicated one-off job scheduler), then a worker
-- takes row locks and sends notifications, with provider-side idempotency keys.
-- A minutely scheduler DOES NOT guarantee delivery at the exact second (24h ± latency).
-- Supabase Free limit for files remains 50 MB, even with resumable upload (TUS).

-- Claim meeting confirmation reminder jobs atomically in ONE transaction:
BEGIN;
WITH due AS (
 SELECT id FROM public.pilot_meeting_confirmation_jobs
 WHERE status IN ('pending','failed') AND remind_at<=clock_timestamp()
 ORDER BY remind_at,id FOR UPDATE SKIP LOCKED LIMIT 100
)
UPDATE public.pilot_meeting_confirmation_jobs q
 SET status='sending',attempts=q.attempts+1
FROM due WHERE q.id=due.id
RETURNING q.id,q.meeting_id,q.project_id,q.remind_at;
-- COMMIT the claim before an external email/push request.
-- ACK after successful dispatch and exact provider response; implement stale lease
-- recovery, max attempts, DLQ and unique provider message key in the worker.
ROLLBACK; -- reference script; do not modify state by running this file.

-- Daily reminder: authenticated worker computes report_date and due_at from
-- pilot_daily_reminder_settings using America/Bogota. Create an outbox row with
-- source_key='daily:YYYY-MM-DD' and recipient_id=authorized QA administrator.
-- UNIQUE(project_id,kind,source_key,recipient_id) prevents duplicate dispatch.
-- Notification message is not the report; the user still submits the report.
-- Successful report submission -> pilot_daily_reports row immediately;
-- agent outbox remains gated until an authorized review sets approved status.
