import unittest
from backend.src.adphor_ai.meeting_email_templates import preview_meeting_email

class EmailTemplateTests(unittest.TestCase):
 def test_escaping(self):
  x=preview_meeting_email({"delegado":"<script>alert(1)</script>","notas":"<img src=x onerror=1>"}, "crear")
  self.assertNotIn("<script>",x["html"])
  self.assertIn("&lt;script&gt;",x["html"])
  self.assertNotIn("<img",x["html"])
  self.assertFalse(x["sent"])
 def test_meet_url(self):
  for link in ("javascript:alert(1)","https://meet.google.com.evil.invalid/hi","https://evil@meet.google.com/hijack"):
   with self.assertRaises(ValueError):preview_meeting_email({}, "confirmar", link)
  self.assertIn("Unirse con Google Meet",preview_meeting_email({}, "confirmar", "https://meet.google.com/abc-defg-hij")["html"])
 def test_known_events(self):
  for event in ("crear","editar","confirmar","eliminar","recordatorio"):
   self.assertEqual(preview_meeting_email({"id":"M-1"},event)["status"],"preview_only")
