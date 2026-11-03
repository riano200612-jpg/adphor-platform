from datetime import datetime, timedelta, timezone, date
from uuid import uuid4
import unittest
from backend.porto_service import PortoService, Actor, AuthorizationError

T=datetime(2026,10,29,13,tzinfo=timezone.utc)


class StubRepo:
    def __init__(self): self.calls=[]
    def membership_role(self,project,user): return {'a':'admin','b':'technician'}.get(user)
    def insert_meeting(self,*args): self.calls.append(('meeting',args));return 'meeting'
    def create_late_request(self,*args):self.calls.append(('late',args));return 'late'
    def insert_report_idempotent(self,*args):self.calls.append(('report',args));return 'report'
    def create_private_upload_intent(self,*args):self.calls.append(('upload',args));return 'upload'
    def insert_pqrs(self,*args):self.calls.append(('pqrs',args));return 'pqrs'
    def transactional_decide_late(self,*args):self.calls.append(('decision',args));return 'decision'


class TestService(unittest.TestCase):
    def setUp(self): self.repo=StubRepo();self.s=PortoService(self.repo)

    def test_denies_unknown_role(self):
        with self.assertRaises(AuthorizationError):
            self.s.schedule(Actor('stranger'),'porto-castello-qa','QA',T+timedelta(days=2),T+timedelta(days=2,hours=1),T)
        self.assertEqual(self.repo.calls,[])

    def test_normal_scheduled(self):
        result=self.s.schedule(Actor('a'),'porto-castello-qa','QA',T+timedelta(days=2),T+timedelta(days=2,hours=1),T)
        self.assertEqual(result,'meeting')

    def test_under_24_hours_routes_to_manager(self):
        result=self.s.schedule(Actor('a'),'porto-castello-qa','QA',T+timedelta(hours=2),T+timedelta(hours=3),T,reason='Razón urgente para QA')
        self.assertEqual(result,'late')
        self.assertEqual(self.repo.calls[0][0],'late')

    def test_no_short_reason(self):
        with self.assertRaises(ValueError):
            self.s.schedule(Actor('a'),'porto-castello-qa','QA',T+timedelta(hours=2),T+timedelta(hours=3),T,reason='No')
        self.assertEqual(self.repo.calls,[])

    def test_only_admin_approves(self):
        with self.assertRaises(AuthorizationError):
            self.s.decide_late(Actor('b'),'porto-castello-qa',uuid4(),True,T)

    def test_upload_size_limit(self):
        with self.assertRaises(ValueError):
            self.s.create_upload_intent(Actor('a'),'porto-castello-qa',uuid4(),'x.mp4','video/mp4',60*1024*1024)

    def test_reports_idempotency_delegated(self):
        id=uuid4()
        self.assertEqual(self.s.submit_daily_report(Actor('a'),'porto-castello-qa',date(2026,10,29),'Resumen QA largo',id),'report')
        self.assertEqual(self.repo.calls[0][0],'report')

if __name__=='__main__':unittest.main()
