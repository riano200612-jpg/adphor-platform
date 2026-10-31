import os
import unittest
from unittest.mock import patch
from fastapi import FastAPI, Request
from fastapi.testclient import TestClient
from backend.src.adphor_ai.evidence_api_qa import build_evidence_router

class FakeStorage:
    def __init__(self):
        self.calls=[]
    async def post(self,url,**kwargs):
        self.calls.append((url,kwargs))
        return type("Response",(),{"status_code":200,"is_success":True})()

class EvidenceQaTests(unittest.TestCase):
    def setUp(self):
        self.storage=FakeStorage()
        self.case_exists=True
        self.membership_calls=0
        async def identity():
            return {"id":"user-qa","token":"test-token"}
        async def membership(request,actor,project,allowed):
            self.membership_calls+=1
            if project!="qa-prop": raise RuntimeError("unexpected scope")
        async def read(request,token,path,params=None):
            return [{"id":"case-1"}] if self.case_exists else []
        app=FastAPI()
        app.include_router(build_evidence_router(
            identity_dependency=identity,membership_checker=membership,
            http_get=read,base_url="https://abcdefghijklmnopqrst.supabase.co",
            publishable_key="sb_publishable_test"))
        app.state.http=self.storage
        self.client=TestClient(app)
        self.path="/qa/projects/qa-prop/cases/case-1/evidence"
        self.env=patch.dict(os.environ,{"ADPHOR_ISOLATED_QA":"true",
                  "ADPHOR_QA_EVIDENCE_BUCKET":"adphor-private-qa",
                  "ADPHOR_QA_PRIVATE_BUCKET_VERIFIED":"true"})
        self.env.start()
    def tearDown(self):
        self.env.stop()
    def test_storage_write_stays_in_tenant_path_no_notifications(self):
        r=self.client.post(self.path,params={"kind":"pqrs"},data=b"testbytes",
                          headers={"content-type":"image/png"})
        self.assertEqual(r.status_code,200,r.text)
        self.assertTrue(r.json()["storage_written"])
        self.assertFalse(r.json()["metadata_linked"])
        self.assertFalse(r.json()["notifications_sent"])
        self.assertEqual(len(self.storage.calls),1)
        self.assertIn("/qa-prop/pqrs/case-1/",self.storage.calls[0][0])
    def test_missing_case_does_not_upload(self):
        self.case_exists=False
        r=self.client.post(self.path,data=b"testbytes",headers={"content-type":"image/png"})
        self.assertEqual(r.status_code,404)
        self.assertEqual(len(self.storage.calls),0)
    def test_disabled_qa_does_not_upload(self):
        with patch.dict(os.environ,{"ADPHOR_ISOLATED_QA":"false"}):
            r=self.client.post(self.path,data=b"testbytes",headers={"content-type":"image/png"})
        self.assertEqual(r.status_code,503)
        self.assertEqual(self.membership_calls,0)
        self.assertEqual(len(self.storage.calls),0)
    def test_disallowed_mime_does_not_upload(self):
        r=self.client.post(self.path,data=b"<html>",headers={"content-type":"text/html"})
        self.assertEqual(r.status_code,415)
        self.assertEqual(len(self.storage.calls),0)
    def test_unverified_bucket_blocks_before_membership_or_storage(self):
        with patch.dict(os.environ,{"ADPHOR_QA_PRIVATE_BUCKET_VERIFIED":"false"}):
            r=self.client.post(self.path,data=b"testbytes",
                               headers={"content-type":"image/png"})
        self.assertEqual(r.status_code,503)
        self.assertEqual(self.membership_calls,0)
        self.assertEqual(self.storage.calls,[])
    def test_oversized_declared_length_rejected_before_storage(self):
        r=self.client.post(self.path,data=b"testbytes",
                           headers={"content-type":"image/png","content-length":str(20*1024*1024+1)})
        self.assertEqual(r.status_code,413)
        self.assertEqual(self.storage.calls,[])
    def test_storage_response_does_not_pretend_metadata_persisted(self):
        r=self.client.post(self.path,data=b"testbytes",
                           headers={"content-type":"application/pdf"})
        self.assertEqual(r.status_code,200)
        self.assertIs(r.json()["metadata_linked"],False)
        self.assertIs(r.json()["notifications_sent"],False)
if __name__=="__main__": unittest.main()
