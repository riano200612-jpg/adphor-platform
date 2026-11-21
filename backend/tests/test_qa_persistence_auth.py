import unittest
from fastapi.testclient import TestClient
from backend.local_api import app

class QaPersistenceGuardTests(unittest.TestCase):
    def test_qa_read_requires_token(self):
        # TestClient lifespan requires server environment: bypass initialization for auth denial.
        client=TestClient(app)
        for route in ('/qa/projects/porto/meetings','/qa/projects/porto/pqrs'):
            res=client.get(route)
            self.assertEqual(res.status_code,401)

if __name__=='__main__':
    unittest.main()
