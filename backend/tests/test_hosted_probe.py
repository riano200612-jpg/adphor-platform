"""Offline harness tests. Not evidence of hosted JWT/RLS success."""
import base64
import json
import unittest
import time
import httpx
from qa.security.hosted_probe import Config, ProbeError, run, PRODUCTION

REF='q'*20

def token(sub,aal):
    payload={'sub':sub,'aal':aal,'exp':time.time()+3600,'role':'authenticated','iss':f'https://{REF}.supabase.co/auth/v1'}
    return 'synthetic.'+base64.urlsafe_b64encode(json.dumps(payload).encode()).decode().rstrip('=')+'.synthetic'

class ProbeTests(unittest.TestCase):
    def setUp(self):
        self.config=Config(REF,'sb_publishable_synthetic',token('a','aal1'),token('a','aal2'),token('b','aal2'))
        self.mode='normal';self.calls=0
    def handler(self,request):
        self.calls+=1
        if self.mode=='redirect':return httpx.Response(302,headers={'location':'https://example.invalid'})
        from qa.security.hosted_probe import claims
        data=claims(request.headers['authorization'].split()[1]);user=data['sub'];aal=data['aal']
        if request.url.path=='/auth/v1/user':return httpx.Response(200,json={'id':user})
        project=request.url.params.get('project_id','').replace('eq.','')
        own=project=='qa-'+user and aal=='aal2'
        if request.url.path.startswith('/rest'):
            if self.mode=='server-error':return httpx.Response(500)
            if self.mode=='empty':return httpx.Response(200,json=[])
            rows=[{'id':'s1','project_id':project},{'id':'s2','project_id':project}] if own or self.mode=='leak' else []
            return httpx.Response(200,json=rows)
        project=request.url.path.split('/')[-2]
        own=project=='qa-'+user and aal=='aal2'
        return httpx.Response(200,content=('ADPHOR '+project+' SYNTHETIC PROBE\n').encode()) if own else httpx.Response(404)
    def execute(self):return run(self.config,httpx.MockTransport(self.handler))
    def test_expected_contract(self):self.assertEqual(len(self.execute()['results']),13)
    def test_production_never_contacted(self):
        self.config=Config(PRODUCTION,*list(self.config.__dict__.values())[1:])
        with self.assertRaises(ProbeError):self.execute()
        self.assertEqual(self.calls,0)
    def test_empty_positive_not_false_pass(self):
        self.mode='empty'
        with self.assertRaises(ProbeError):self.execute()
    def test_leak_fails(self):
        self.mode='leak'
        with self.assertRaises(ProbeError):self.execute()
    def test_500_is_not_denial(self):
        self.mode='server-error'
        with self.assertRaises(ProbeError):self.execute()
    def test_redirect_not_followed(self):
        self.mode='redirect'
        with self.assertRaises(ProbeError):self.execute()
        self.assertEqual(self.calls,1)
    def test_secret_key_rejected_before_network(self):
        self.config=Config(REF,'sb_secret_synthetic',self.config.a1,self.config.a2,self.config.b2)
        with self.assertRaises(ProbeError):self.execute()
        self.assertEqual(self.calls,0)
