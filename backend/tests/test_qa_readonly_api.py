"""Adversarial QA-only read gateway tests, no network or secret credentials."""
import base64
import json
import unittest
from urllib.parse import urlparse, parse_qs
from adphor_ai.gateway import Configuracion, ConexionError
from adphor_ai.qa_readonly_api import handle_agent_readonly, QA_URL, QA_ORIGIN

PROJECT = 'qa-prop'
USER = '11111111-2222-4333-8444-555555555555'
RUN = '12345678-1234-4123-8123-123456789abc'
SUMMARY = {'id':RUN,'project_id':PROJECT,'engine_kind':'rules',
           'status':'Pendiente de aprobación del administrador',
           'source_read_at':'2026-11-17T18:00:00Z'}
DETAIL = {**SUMMARY,'draft':'BORRADOR SINTÉTICO','result_hash':'a'*64}

def token(aal='aal2', sub=USER):
    data={'sub':sub,'role':'authenticated','aal':aal}
    payload=base64.urlsafe_b64encode(json.dumps(data).encode()).decode().rstrip('=')
    return 'synthetic.' + payload + '.synthetic'


class ReadOnlyQATests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.config=Configuracion(QA_URL,'sb_publishable_qa_synthetic',QA_ORIGIN)
        self.calls=[]
        self.aal='aal2'
        self.role='admin'
        self.registry=[]
        self.reviews=[]
        self.rows=[]
        self.auth=(200,{'id':USER})
        self.mode='normal'

    async def get(self,url,headers):
        self.calls.append((url,headers))
        self.assertTrue(url.startswith(QA_URL+'/'))
        self.assertEqual(headers.get('apikey'),'sb_publishable_qa_synthetic')
        self.assertNotIn('sb_secret_',str(headers))
        self.assertTrue(headers['Authorization'].startswith('Bearer '))
        if self.mode=='broken':
            raise RuntimeError('Sensitive provider stack')
        if self.mode=='redirect':
            return 302,{'location':'https://evil.example'}
        if '/auth/v1/user' in url:
            return self.auth
        if '/rpc/project_role' in url:
            self.assertEqual(parse_qs(urlparse(url).query).get('project'),[PROJECT])
            return 200,self.role
        if '/agent_reviews' in url:
            return 200,self.reviews
        if '/agent_run_status' in url:
            if 'limit=0' in url:
                return 200,self.registry
            return 200,self.rows
        self.fail('Unexpected URL: '+url)

    async def execute(self,path='/agent-readiness',query=None,method='GET',
                      bearer=None,enabled=True,config=None):
        return await handle_agent_readonly(config or self.config,
            'Bearer '+token(self.aal) if bearer is None else bearer,
            method,path,query if query is not None else {'project_id':[PROJECT]},
            self.get,enabled=enabled)

    async def denied(self,status,**kwargs):
        with self.assertRaises(ConexionError) as err:
            await self.execute(**kwargs)
        self.assertEqual(err.exception.status,status, str(err.exception))
        self.assertNotIn('Sensitive provider stack',str(err.exception))

    async def test_preflight_never_reports_models_or_writes_ready(self):
        data=await self.execute()
        self.assertEqual(data,{'mode':'qa_rules_only','project_id':PROJECT,
            'registry_ready':True,'reviews_ready':False,
            'rules_ready':False,'models_ready':False})
        self.assertEqual(len(self.calls),4)
        self.assertTrue(all(url.startswith(QA_URL+'/') for url,_ in self.calls))
        self.assertTrue(all('service_role' not in str(headers) for _,headers in self.calls))

    async def test_disabled_gate_production_url_or_origin_make_zero_requests(self):
        await self.denied(503,enabled=False)
        await self.denied(503,config=Configuracion(
            'https://oqizvirqjwbbhyyjpthq.supabase.co',
            'sb_publishable_fake',QA_ORIGIN))
        await self.denied(503,config=Configuracion(
            QA_URL,'sb_publishable_fake','https://adphor-platform.pages.dev'))
        self.assertEqual(self.calls,[])

    async def test_anonymous_and_invalid_arguments_fail_before_network(self):
        await self.denied(401,bearer='')
        await self.denied(400,query={'project_id':['../another']})
        await self.denied(400,query={'project_id':[PROJECT,'other']})
        await self.denied(400,query={'project_id':[PROJECT],'other':['x']})
        await self.denied(400,path='/agent-runs',query={'project_id':[PROJECT],'limit':['200']})
        await self.denied(400,path='/agent-runs',query={'project_id':[PROJECT],'offset':['-1']})
        await self.denied(400,path='/agent-runs',query={'project_id':[PROJECT],'offset':['10001']})
        await self.denied(404,path='/agent-runs/../another')
        await self.denied(405,method='POST')
        self.assertEqual(self.calls,[])

    async def test_authenticated_identity_does_not_replace_aal2(self):
        self.aal='aal1'
        await self.denied(403)
        self.assertEqual(len(self.calls),1)
        self.aal='aal2'
        await self.denied(403,bearer='Bearer '+token(sub='another'))
        self.assertEqual(len(self.calls),2)

    async def test_revoked_user_is_denied_without_any_database_query(self):
        self.auth=(401,{'message':'session expired'})
        await self.denied(401)
        self.assertEqual(len(self.calls),1)

    async def test_inactive_or_unapproved_role_is_denied(self):
        for role in (None,'viewer','technician','superuser'):
            self.role=role
            await self.denied(403)
        self.assertEqual(len([u for u,_ in self.calls if 'agent_run_status' in u]),0)

    async def test_coordinator_can_read_but_never_approve(self):
        self.role='coordinator'
        result=await self.execute()
        self.assertFalse(result['reviews_ready'])
        self.assertFalse(result['rules_ready'])

    async def test_list_is_scoped_and_paged(self):
        self.rows=[SUMMARY]
        result=await self.execute('/agent-runs',
            {'project_id':[PROJECT],'limit':['20'],'offset':['40']})
        self.assertEqual(result['items'],self.rows)
        self.assertEqual(result['limit'],20)
        self.assertEqual(result['offset'],40)
        self.assertIn('&offset=40',self.calls[-1][0])
        self.assertIn('&project_id=eq.'+PROJECT,self.calls[-1][0])
        self.assertNotIn('source_snapshot',self.calls[-1][0])

    async def test_other_tenant_rows_never_reach_client(self):
        self.rows=[{**SUMMARY,'project_id':'other'}]
        await self.denied(502,path='/agent-runs')
        self.assertTrue(any('agent_run_status' in x for x,_ in self.calls))

    async def test_detail_is_scoped_and_exact_uuid(self):
        self.rows=[DETAIL]
        data=await self.execute('/agent-runs/'+RUN)
        self.assertEqual(data['id'],RUN)
        self.assertIn('id=eq.'+RUN,self.calls[-1][0])
        self.assertIn('project_id=eq.'+PROJECT,self.calls[-1][0])
        self.rows=[]
        await self.denied(404,path='/agent-runs/'+RUN)

    async def test_invalid_status_and_hash_fail_closed(self):
        self.rows=[{**SUMMARY,'status':'Approved by unknown'}]
        await self.denied(502,path='/agent-runs')
        self.rows=[{**DETAIL,'result_hash':'forged'}]
        await self.denied(502,path='/agent-runs/'+RUN)

    async def test_provider_failure_or_redirect_never_exposes_internal_details(self):
        for mode,status in [('broken',503),('redirect',502)]:
            self.mode=mode
            await self.denied(status)

    async def test_missing_registry_response_is_not_success(self):
        self.registry={'unexpected':'object'}
        await self.denied(502)

    async def test_no_mutation_capabilities_in_gateway(self):
        self.assertFalse(hasattr(self.config,'writer_key'))
        await self.denied(405,method='DELETE',path='/agent-runs/'+RUN)
        self.assertEqual(self.calls,[])


if __name__ == '__main__':
    unittest.main()
