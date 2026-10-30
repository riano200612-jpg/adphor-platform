import unittest
from datetime import datetime, timezone, timedelta
from adphor_ai.scheduling import classify_priority, validate_slot, authorize_change

T = timezone.utc
def at(h, m=0):
    return datetime(2026, 11, 3, h, m, tzinfo=T)

from adphor_ai.scheduling import validate_meeting_request

class SchedulingTests(unittest.TestCase):
    def test_backend_24h_gate(self):
        now = at(10)
        result = validate_meeting_request(at(11), at(12), now, [], [], False)
        self.assertFalse(result["allowed"])
        self.assertTrue(result["request_exception"])

    def test_backend_exception_after_approval(self):
        result = validate_meeting_request(at(11), at(12), at(10), [], [], False,
                                          actor_role="admin", approval=True)
        self.assertTrue(result["allowed"])

    def test_backend_conflict_even_with_approval(self):
        existing = [{"id": 1, "starts_at": at(10), "ends_at": at(11),
                     "requires_management": True, "participants": [], "status": "scheduled"}]
        result = validate_meeting_request(at(10,30), at(11,30), at(9), existing, [],
                                          True, actor_role="admin", approval=True)
        self.assertFalse(result["allowed"])
        self.assertTrue(result["conflicts"])

    def test_critical_priority(self):
        self.assertEqual(classify_priority("Riesgo estructural en torre A")["priority_level"], "alto")

    def test_management_overlap_blocked(self):
        existing = [{"id": 1, "starts_at": at(10), "ends_at": at(11),
                     "requires_management": True, "participants": [], "status": "scheduled"}]
        self.assertEqual(len(validate_slot(at(10, 30), at(11, 30), existing, [], True)), 1)

    def test_management_buffer_blocked(self):
        existing = [{"id": 1, "starts_at": at(10), "ends_at": at(11),
                     "requires_management": True, "participants": [], "status": "scheduled"}]
        self.assertEqual(len(validate_slot(at(11, 10), at(12), existing, [], True)), 1)
        self.assertEqual(len(validate_slot(at(11, 15), at(12), existing, [], True)), 0)

    def test_cancelled_not_blocking(self):
        existing = [{"id": 1, "starts_at": at(10), "ends_at": at(11),
                     "requires_management": True, "participants": [], "status": "cancelled"}]
        self.assertEqual(validate_slot(at(10), at(11), existing, [], True), [])

    def test_high_cannot_move_without_approval(self):
        with self.assertRaises(PermissionError):
            authorize_change({"priority_level": "alto"}, "administrator", False)
        authorize_change({"priority_level": "alto"}, "administrator", True)

    def test_naive_time_rejected(self):
        with self.assertRaises(ValueError):
            validate_slot(datetime(2026, 11, 3, 10), at(11), [], [], False)

if __name__ == "__main__":
    unittest.main()
