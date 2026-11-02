import os
import unittest
from copy import deepcopy
from datetime import datetime, timezone
from unittest.mock import patch
import httpx
from fastapi.testclient import TestClient

from backend.local_api import app
from backend.src.adphor_ai.gateway import Configuracion
from backend.src.adphor_ai.rules import run_rules, PENDING

USER = '11111111-1111-4111-8111-111111111111'
RUN = '22222222-2222-4222-8222-222222222222'
CASE = '33333333-3333-4333-8333-333333333333'
NOW = datetime(2026,10,22,12,tzinfo=timezone.utc)
TICKET = {'id':CASE,'project_id':'demo-01','version':1,'status':'Por verificar','assignee':None,'due_date':'2026-10-20'}
MEMBER = {'project_id':'demo-01','user_id':USER,'role':'admin'}


class RulesTests(unittest.TestCase):
    def test_overlapping_findings_count_unique_cases_and_preserve_input(self):
        tickets = [deepcopy(TICKET)]
        payload = run_rules('demo-01',tickets,[MEMBER],NOW,RUN,USER)
        self.assertEqual(tickets,[TICKET])
        self.assertEqual(len(payload['findings']),3)
        self.assertIn('Casos únicos con hallazgos: 1.',payload['draft'])
        self.assertIn(PENDING,payload['draft'])
        self.assertEqual(payload['engine_kind'],'rules')
        self.assertEqual(len(payload['steps']),3)

    def test_closed_cases_are_excluded_and_date_uses_colombia(self):
        t = dict(TICKET,status='Cerrada')
        out = run_rules('demo-01',[t],[MEMBER],NOW,RUN,USER)
        self.assertEqual(out['findings'],[])
        t = dict(TICKET,status='Pendiente',assignee=USER,due_date='2026-10-21')
        out = run_rules('demo-01',[t],[MEMBER],datetime(2026,10,22,2,tzinfo=timezone.utc),RUN,USER)
        self.assertEqual(out['findings'],[])

    def test_invalid_sources_fail_and_hash_binds_sources(self):
        for tickets in ([dict(TICKET,project_id='other')],[TICKET,TICKET],[dict(TICKET,due_date='bad')]):
            with self.assertRaises(ValueError): run_rules('demo-01',tickets,[MEMBER],NOW,RUN,USER)
        a = run_rules('demo-01',[TICKET],[MEMBER],NOW,RUN,USER)
        b = run_rules('demo-01',[dict(TICKET,version=2)],[MEMBER],NOW,RUN,USER)
        self.assertNotEqual(a['result_hash'],b['result_hash'])


class APITests(unittest.TestCase):
    def setUp(self):
        # Bind fixtures per test, independent of module import order or host credentials.
        settings=patch.multiple('backend.local_api',BASE='https://test.supabase.co',
            KEY='sb_publishable_test',Config=Configuracion('https://test.supabase.co',
                'sb_publishable_test','https://qa.example.invalid'))
        settings.start()
        self.addCleanup(settings.stop)
        self.role = 'admin'
        self.inserts = []
        self.reads = 0
        self.changed = False
        self.existing = []
        self.keys = patch.dict(os.environ,{'SUPABASE_AGENT_WRITER_KEY':'sb_secret_test_only'})
        self.keys.start()

    def tearDown(self): self.keys.stop()

    def upstream(self, req):
        path = req.url.path
        if req.method == 'POST':
            self.assertEqual(path,'/rest/v1/agent_runs')
            self.assertEqual(req.headers['apikey'],'sb_secret_test_only')
            self.assertNotIn('authorization',req.headers)
            import json
            self.inserts.append(json.loads(req.content))
            return httpx.Response(201)
        self.assertEqual(req.headers['authorization'],'Bearer user-test-token')
        self.assertEqual(req.headers['apikey'],'sb_publishable_test')
        if path == '/auth/v1/user': return httpx.Response(200,json={'id':USER})
        if path == '/rest/v1/memberships':
            return httpx.Response(200,json=[dict(MEMBER,role=self.role)])
        if path == '/rest/v1/tickets':
            self.reads += 1
            return httpx.Response(200,json=[dict(TICKET,version=2 if self.changed and self.reads>1 else 1)])
        if path == '/rest/v1/agent_runs': return httpx.Response(200,json=self.existing)
        if path == '/rest/v1/agent_run_status': return httpx.Response(200,json=[])
        raise AssertionError(path)

    def run_request(self, method='POST', json=None, auth=True, path='/agent-runs'):
        with TestClient(app) as client:
            with patch.object(app.state,'http',httpx.AsyncClient(transport=httpx.MockTransport(self.upstream))):
                return client.request(method,path,headers={'Authorization':'Bearer user-test-token'} if auth else {},
                                      json=json if json is not None else {'project_id':'demo-01','request_id':RUN})

    def test_success_inserts_only_pending_rules_snapshot(self):
        response = self.run_request()
        self.assertEqual(response.status_code,200,response.text)
        self.assertEqual(response.json()['status'],PENDING)
        self.assertEqual(len(self.inserts),1)
        self.assertNotIn('administrator_id',self.inserts[0])
        self.assertNotIn('decision',self.inserts[0])

    def test_missing_session_denied(self):
        self.assertEqual(self.run_request(auth=False).status_code,401)
        self.assertEqual(self.inserts,[])

    def test_non_admin_cannot_run(self):
        for role in ['coordinator','viewer','technician']:
            self.role = role
            self.assertEqual(self.run_request().status_code,403)
        self.assertEqual(self.inserts,[])

    def test_missing_writer_key_is_not_fake_success(self):
        with patch.dict(os.environ,{'SUPABASE_AGENT_WRITER_KEY':''}):
            self.assertEqual(self.run_request().status_code,503)
        self.assertEqual(self.inserts,[])

    def test_changed_snapshot_does_not_write(self):
        self.changed = True
        self.assertEqual(self.run_request().status_code,409)
        self.assertEqual(self.inserts,[])

    def test_idempotency_returns_existing_without_new_insert(self):
        self.existing = [{'id':RUN,'project_id':'demo-01','source_snapshot':{'requested_by':USER}}]
        self.assertTrue(self.run_request().json()['reused'])
        self.assertEqual(self.inserts,[])

    def test_request_cannot_inject_a_draft(self):
        response = self.run_request(json={'project_id':'demo-01','request_id':RUN,'draft':'Inventado'})
        self.assertEqual(response.status_code,422)
        self.assertEqual(self.inserts,[])

    def test_hidden_detail_returns_not_found(self):
        self.assertEqual(self.run_request(method='GET',path='/agent-runs/'+RUN).status_code,404)


if __name__ == '__main__': unittest.main()
