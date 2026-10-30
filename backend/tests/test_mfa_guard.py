"""Assurance contracts after mocked upstream token validation, not real JWT tests."""
import base64
import json
import unittest
from fastapi import HTTPException
from backend.src.adphor_ai.mfa_guard import require_enrolled_mfa

class MfaGuardTests(unittest.TestCase):
    def token(self, **claims):
        return 'synthetic.'+base64.urlsafe_b64encode(json.dumps(claims).encode()).decode().rstrip('=')+'.synthetic'
    def test_verified_factor_requires_aal2(self):
        user={'id':'qa-a','factors':[{'status':'verified'}]}
        for token in ['', 'malformed', self.token(sub='qa-a',aal='aal1'),self.token(sub='qa-b',aal='aal2')]:
            with self.subTest(token=bool(token)),self.assertRaises(HTTPException):
                require_enrolled_mfa(user,token)
        require_enrolled_mfa(user,self.token(sub='qa-a',aal='aal2'))
    def test_no_factor_does_not_enroll_or_reset(self):
        require_enrolled_mfa({'id':'qa-a'},'already-validated-upstream')
