import unittest
from adphor_ai.gateway import Configuracion, ConexionError, verificar_sesion


class GatewayTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.config = Configuracion('https://example.supabase.co','sb_publishable_test',
                                    'https://adphor-platform.pages.dev')
        self.calls = []
        self.auth = (200, {'id':'user-1'})
        self.members = (200, [{'role':'admin'}])

    async def fetch(self, url, headers):
        self.calls.append((url,headers))
        return self.auth if '/auth/v1/user' in url else self.members

    async def test_verifies_auth_then_membership_with_user_token(self):
        r=await verificar_sesion(self.config,'Bearer test-token','demo-01',self.fetch)
        self.assertEqual(len(self.calls),2)
        self.assertIn('/auth/v1/user',self.calls[0][0])
        self.assertIn('user_id=eq.user-1',self.calls[1][0])
        self.assertEqual(self.calls[1][1]['Authorization'],'Bearer test-token')
        self.assertTrue(r['can_approve'])
        self.assertFalse(r['swarm_ready'])

    async def test_invalid_auth_never_queries_membership(self):
        self.auth=(401, {'secret':'must not appear in errors'})
        with self.assertRaises(ConexionError) as error:
            await verificar_sesion(self.config,'Bearer invalid','demo-01',self.fetch)
        self.assertEqual(error.exception.status,401)
        self.assertNotIn('secret',str(error.exception))
        self.assertEqual(len(self.calls),1)

    async def test_no_membership_is_forbidden(self):
        self.members=(200,[])
        with self.assertRaises(ConexionError) as error:
            await verificar_sesion(self.config,'Bearer token','other',self.fetch)
        self.assertEqual(error.exception.status,403)

    async def test_only_admin_can_approve(self):
        for role in ('coordinator','technician','viewer'):
            self.members=(200,[{'role':role}])
            r=await verificar_sesion(self.config,'Bearer token','p1',self.fetch)
            self.assertFalse(r['can_approve'])

    async def test_bad_input_causes_no_external_request(self):
        for token,project in [('', 'p1'),('Bearer ok','p1&role=admin')]:
            with self.assertRaises(ConexionError):
                await verificar_sesion(self.config,token,project,self.fetch)
        self.assertEqual(self.calls,[])

    async def test_configuration_rejects_non_supabase_and_secret_keys(self):
        for cfg in [Configuracion('https://evil.example','sb_publishable_test',self.config.origen_web),
                    Configuracion(self.config.supabase_url,'sb_secret_forbidden',self.config.origen_web)]:
            with self.assertRaises(ConexionError): cfg.validar()
