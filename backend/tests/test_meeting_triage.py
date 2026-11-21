import unittest
from adphor_ai.meeting_triage import assess_meeting, build_notification_intents


class TriageTests(unittest.TestCase):
    def test_high_priority_requires_management(self):
        result = assess_meeting("Emergencia de seguridad en portería")
        self.assertEqual(result.priority_level, "alto")
        self.assertTrue(result.requires_management)

    def test_medium_priority_is_not_automatic_management(self):
        result = assess_meeting("Mantenimiento preventivo")
        self.assertEqual(result.priority_level, "medio")
        self.assertFalse(result.requires_management)

    def test_administrator_can_request_management(self):
        result = assess_meeting("Reunión ordinaria", management_requested=True)
        self.assertEqual(result.priority_level, "bajo")
        self.assertTrue(result.requires_management)

    def test_notifications_require_project_role_and_channel_consent(self):
        result = assess_meeting("Incendio en zonas comunes")
        contacts = [
            {"id": "g1", "project_id": "porto", "role": "management",
             "email": "manager@example.invalid", "sms": "+000", "whatsapp": "+000",
             "consent_email": True, "consent_sms": False, "consent_whatsapp": True},
            {"id": "g2", "project_id": "other", "role": "management",
             "email": "other@example.invalid", "consent_email": True},
            {"id": "r1", "project_id": "porto", "role": "viewer",
             "email": "viewer@example.invalid", "consent_email": True},
        ]
        queued = build_notification_intents("meeting1", "porto", result, contacts)
        self.assertEqual({e["channel"] for e in queued}, {"email", "whatsapp"})
        self.assertTrue(all(e["recipient_id"] == "g1" and e["status"] == "pending_review" for e in queued))
        self.assertEqual(len(set(e["idempotency_key"] for e in queued)), len(queued))
        self.assertTrue(all("address" not in e for e in queued))

    def test_no_alert_for_ordinary_meeting(self):
        self.assertEqual(build_notification_intents("meeting1", "porto",
                         assess_meeting("Reunión ordinaria"), []), [])


if __name__ == "__main__":
    unittest.main()
