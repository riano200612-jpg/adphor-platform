import unittest
from backend.src.adphor_ai.evidence_signatures import matches_evidence_signature

class EvidenceSignatureTests(unittest.TestCase):
    def test_allowed_headers(self):
        samples={
          "image/jpeg":bytes.fromhex("ffd8ff")+b"qa",
          "image/png":bytes.fromhex("89504e470d0a1a0a")+b"qa",
          "image/webp":b"RIFF"+b"1234"+b"WEBP",
          "application/pdf":b"%PDF-1.7\nQA",
          "video/mp4":bytes.fromhex("0000001866747970")+b"isom",
          "video/webm":bytes.fromhex("1a45dfa3")+b"qa",
        }
        for mime,data in samples.items():
            with self.subTest(mime=mime):
                self.assertTrue(matches_evidence_signature(mime,data))
                self.assertFalse(matches_evidence_signature(mime,b"<html>qa"))
    def test_mime_mismatch(self):
        self.assertFalse(matches_evidence_signature("image/png",b"%PDF-1.7"))
        self.assertFalse(matches_evidence_signature("image/jpeg",b""))
