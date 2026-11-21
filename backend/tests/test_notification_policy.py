import unittest
from backend.src.adphor_ai.notification_policy import authorize_delivery, record_lockout

class NotificationPolicyTests(unittest.TestCase):
    def test_qa_never_delivers_even_if_approved(self):
        for channel in ("email", "sms", "whatsapp", "calendar_invitation"):
            self.assertFalse(authorize_delivery(environment="qa", explicit_approval=True,
                delivery_enabled=True, channel=channel).allowed)
    def test_default_denies_delivery(self):
        self.assertFalse(authorize_delivery(environment="production").allowed)
    def test_lockout_is_audit_only(self):
        row=record_lockout(project_id="qa-property",actor_id="qa-user",
            account_type="resident",failed_attempts=3)
        self.assertEqual(row["notification_status"],"suppressed_pending_approval")
        self.assertNotIn("email",row)
        self.assertNotIn("pin",row)

if __name__=="__main__":
    unittest.main()
