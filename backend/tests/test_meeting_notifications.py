import unittest
from datetime import datetime, timezone
from backend.src.adphor_ai.meeting_notifications import plan_meeting_email

class MeetingEmailTests(unittest.TestCase):
    def setUp(self):
        self.start=datetime(2026,11,10,16,tzinfo=timezone.utc)
        self.people=[
            {"project_id":"a","user_id":"u1","role":"owner","notifications_enabled":True},
            {"project_id":"a","user_id":"u2","role":"administrator","notifications_enabled":True},
            {"project_id":"a","user_id":"u3","role":"management","notifications_enabled":True},
            {"project_id":"b","user_id":"u4","role":"owner","notifications_enabled":True},
            {"project_id":"a","user_id":"u5","role":"owner","notifications_enabled":False}]
    def test_reminder_scoped_and_24h(self):
        rows=plan_meeting_email(project_id="a",meeting_id="m1",event="meeting_reminder",
          start_at=self.start,recipients=self.people,management_required=True)
        self.assertEqual(len(rows),3)
        self.assertTrue(all(row["delivery_status"]=="pending_approval" for row in rows))
        self.assertTrue(all(row["scheduled_at"]=="2026-11-09T16:00:00+00:00" for row in rows))
    def test_management_requires_case(self):
        rows=plan_meeting_email(project_id="a",meeting_id="m1",event="meeting_created",
          start_at=self.start,recipients=self.people)
        self.assertEqual({x["recipient_user_id"] for x in rows},{"u1","u2"})
    def test_invalid_event_fails(self):
        with self.assertRaises(ValueError):
            plan_meeting_email(project_id="a",meeting_id="m1",event="lockout",start_at=self.start,recipients=self.people)

if __name__=="__main__":unittest.main()
