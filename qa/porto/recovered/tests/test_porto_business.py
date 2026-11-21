import unittest
from datetime import datetime, timedelta, timezone, date
from backend.porto_business import meeting_decision, confirmation_due_at, report_reminder_due
from backend.porto_ingest import build_plan

UTC = timezone.utc
T = datetime(2026, 10, 29, 12, tzinfo=UTC)


class PortoTests(unittest.TestCase):
    def test_normal_booking(self):
        r = meeting_decision(T + timedelta(hours=25),T + timedelta(hours=26),T)
        self.assertTrue(r.allowed)

    def test_lock_23h59(self):
        r = meeting_decision(T + timedelta(hours=23,minutes=59), T + timedelta(hours=25), T)
        self.assertTrue(r.needs_manager_approval)

    def test_exact_24h_boundary(self):
        r = meeting_decision(T + timedelta(hours=24),T + timedelta(hours=25),T)
        self.assertTrue(r.allowed)

    def test_original_start_inside_lock(self):
        r = meeting_decision(T + timedelta(hours=72),T + timedelta(hours=73),T,
                             original_start=T + timedelta(hours=10))
        self.assertTrue(r.needs_manager_approval)

    def test_cancel_past_rejected(self):
        r = meeting_decision(T - timedelta(minutes=1),T + timedelta(hours=2),T)
        self.assertFalse(r.allowed)
        self.assertFalse(r.needs_manager_approval)

    def test_reminder_at_24_hours(self):
        self.assertEqual(confirmation_due_at(T + timedelta(days=2)), T + timedelta(days=1))

    def test_timezone_day_reminder(self):
        d=report_reminder_due(date(2026,10,29))
        self.assertEqual(d.astimezone(UTC).hour,22)

    def test_ingest_fail_closed(self):
        plan=build_plan([{"id":"f1","name":"Informe.pdf","mime_type":"application/pdf",
                          "modified_time":"2026-10-28T21:26:37Z","folder":"MANTENIMIENTOS"}])
        self.assertEqual(len(plan['files']),1)
        self.assertFalse(plan['files'][0]['agent_read_authorized'])
        self.assertEqual(plan['files'][0]['permission_status'],'pending')

    def test_ingest_dedup(self):
        doc={"id":"f1","name":"A.pdf","mime_type":"application/pdf","modified_time":"2026-10-28T21:26:37Z"}
        self.assertEqual(len(build_plan([doc,doc])["files"]),1)

    def test_bad_mime_rejected(self):
        p=build_plan([{"id":"x","name":"malicious.exe","mime_type":"application/x-msdownload","modified_time":"2026-10-28T21:26:37Z"}])
        self.assertEqual(len(p['rejections']),1)

if __name__ == '__main__': unittest.main()
