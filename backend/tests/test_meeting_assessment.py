"""Synthetic HTTP contracts: mocked identity/membership, not JWT/RLS or E2E."""
import unittest
from dataclasses import replace
from fastapi import FastAPI, HTTPException, Request
from fastapi.testclient import TestClient
from backend.src.adphor_ai.meeting_api import build_meeting_router
from backend.src.adphor_ai.tenant_consultation import ConsultationSettings
from backend.src.adphor_ai.meeting_triage import assess_meeting, build_notification_intents

QA = ConsultationSettings(deployment='staging', mode='synthetic',
    supabase_url='https://qa-test.supabase.co', staging_project_ref='qa-test',
    frontend_origin='https://qa.adphor.invalid')

class AssessmentTests(unittest.TestCase):
    def setUp(self):
        self.role = 'admin'
        async def identity(request: Request):
            if request.headers.get('Authorization') != 'Bearer synthetic':
                raise HTTPException(401)
            return {'id': 'qa-user'}
        async def membership(request, actor, project, allowed):
            if project != 'qa-a' or self.role not in allowed:
                raise HTTPException(403)
        self.identity, self.membership = identity, membership
        self.client = self.make_client(QA)

    def make_client(self, settings):
        app = FastAPI()
        app.include_router(build_meeting_router(identity_dependency=self.identity,
            membership_checker=self.membership, settings=settings))
        return TestClient(app)

    def post(self, client=None, **overrides):
        return (client or self.client).post('/meetings/assess',
            json={'project_id':'qa-a', 'subject':'Riesgo estructural', **overrides},
            headers={'Authorization':'Bearer synthetic'})

    def test_rules_and_no_side_effects(self):
        response = self.post()
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['priority_level'], 'alto')
        self.assertEqual(data['engine_kind'], 'rules')
        self.assertEqual(data['status'], 'pending_administrator_review')
        for key in ('persisted','booking_authorized','notifications_sent'):
            self.assertIs(data[key], False)

    def test_missing_session(self):
        self.assertEqual(self.client.post('/meetings/assess',json={
            'project_id':'qa-a','subject':'Consejo'}).status_code,401)

    def test_cross_tenant(self):
        self.assertEqual(self.post(project_id='qa-b').status_code,403)

    def test_revocation(self):
        self.assertEqual(self.post().status_code,200)
        self.role = None
        self.assertEqual(self.post().status_code,403)

    def test_viewer_denied(self):
        self.role = 'viewer'
        self.assertEqual(self.post().status_code,403)

    def test_production_denied(self):
        self.assertEqual(self.post(client=self.make_client(replace(QA,
            deployment='production'))).status_code,503)

    def test_real_database_denied(self):
        settings = replace(QA, staging_project_ref='oqizvirqjwbbhyyjpthq',
            supabase_url='https://oqizvirqjwbbhyyjpthq.supabase.co')
        self.assertEqual(self.post(client=self.make_client(settings)).status_code,503)

    def test_disabled_default(self):
        self.assertEqual(self.post(client=self.make_client(ConsultationSettings())).status_code,503)

    def test_cannot_submit_approval(self):
        self.assertEqual(self.post(approved=True).status_code,422)

    def test_invalid_inputs(self):
        for fields in ({'subject':'   '}, {'notes':'x'*5001}, {'project_id':'../qa-a'}):
            with self.subTest(fields=list(fields)):
                self.assertEqual(self.post(**fields).status_code,422)

    def test_management_is_request_not_approval(self):
        data = self.post(subject='Consejo ordinario',management_requested=True).json()
        self.assertTrue(data['requires_management'])
        self.assertFalse(data['booking_authorized'])

    def test_intents_filter_and_deduplicate(self):
        contact = {'id':'qa-person','project_id':'qa-a','role':'admin',
                   'email':'synthetic@example.invalid','consent_email':True}
        contacts = [contact,contact,{**contact,'project_id':'qa-b'},
            {**contact,'id':'wrong-consent','consent_email':'false'},
            {**contact,'id':''},{**contact,'id':'viewer','role':'viewer'}]
        result = build_notification_intents('meeting-1','qa-a',
            assess_meeting('Emergencia'),contacts)
        self.assertEqual(len(result),1)
        self.assertEqual(result[0]['status'],'pending_review')
        self.assertNotIn('email', result[0])

    def test_ordinary_meeting_no_intents(self):
        self.assertEqual(build_notification_intents('meeting-1','qa-a',
            assess_meeting('Consejo ordinario'),[]),[])
