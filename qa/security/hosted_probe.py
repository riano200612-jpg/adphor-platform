"""Read-only QA probes. No resource creation, login, refresh, mutations or secrets output."""
import base64
import json
import os
import re
import time
from dataclasses import dataclass
import httpx

PRODUCTION = 'oqizvirqjwbbhyyjpthq'

class ProbeError(Exception):
    pass


def claims(token):
    try:
        parts=token.split('.')
        if len(parts)!=3: raise ValueError()
        data=json.loads(base64.urlsafe_b64decode(parts[1]+'='*(-len(parts[1])%4)))
        if not isinstance(data,dict):raise ValueError()
        return data
    except Exception:
        raise ProbeError('Invalid token configuration') from None


@dataclass(frozen=True)
class Config:
    ref: str
    key: str
    a1: str
    a2: str
    b2: str

    @property
    def url(self):return f'https://{self.ref}.supabase.co'

    def validate(self):
        if not re.fullmatch('[a-z]{20}',self.ref) or self.ref==PRODUCTION:
            raise ProbeError('Independent QA project required')
        if not self.key.startswith('sb_publishable_'):
            if claims(self.key).get('role')!='anon':raise ProbeError('Public client key required')
        values=[claims(t) for t in (self.a1,self.a2,self.b2)]
        for data,level in zip(values,('aal1','aal2','aal2')):
            if data.get('role')!='authenticated' or data.get('aal')!=level or data.get('iss')!=self.url+'/auth/v1':
                raise ProbeError('Token role, issuer or assurance mismatch')
            if not isinstance(data.get('sub'),str) or not data['sub']:raise ProbeError('Missing user identity')
            if not isinstance(data.get('exp'),(int,float)) or data['exp']<time.time()+300:
                raise ProbeError('Fresh QA tokens with at least five minutes remaining required')
        if values[0]['sub']!=values[1]['sub'] or values[1]['sub']==values[2]['sub']:
            raise ProbeError('Two distinct QA identities required')


def run(config, transport=None):
    config.validate()  # Never connect before validating the destination and keys.
    results=[]
    with httpx.Client(base_url=config.url,timeout=10,follow_redirects=False,
                      trust_env=False,transport=transport) as client:
        def get(path,token):
            try:
                with client.stream('GET',path,headers={'apikey':config.key,'Authorization':'Bearer '+token}) as r:
                    chunks=[];size=0
                    for chunk in r.iter_bytes():
                        size+=len(chunk)
                        if size>16384:raise ProbeError('Oversized response')
                        chunks.append(chunk)
                    return r.status_code,b''.join(chunks)
            except httpx.HTTPError:
                raise ProbeError('QA endpoint unavailable') from None
        # Supabase validates each actual bearer. Local decoding alone never passes a probe.
        for label,token in [('A1',config.a1),('A2',config.a2),('B2',config.b2)]:
            status,body=get('/auth/v1/user',token)
            try: data=json.loads(body)
            except ValueError:raise ProbeError('Auth response invalid') from None
            if status!=200 or not isinstance(data,dict) or data.get('id')!=claims(token)['sub']:
                raise ProbeError('Upstream identity validation failed')
            results.append({'case':'AUTH-'+label,'result':'PASS'})

        def rest(label,token,project,visible):
            status,body=get('/rest/v1/pilot_pqrs?select=id,project_id&project_id=eq.'+project+'&limit=2',token)
            if status in (401,403) and not visible:
                results.append({'case':label,'result':'PASS'});return
            if status!=200:raise ProbeError('REST probe failed: '+label)
            try:rows=json.loads(body)
            except ValueError:raise ProbeError('REST response invalid') from None
            if not isinstance(rows,list):raise ProbeError('REST shape invalid')
            if visible:
                if len(rows)!=2 or any(not isinstance(r,dict) or not r.get('id') or r.get('project_id')!=project for r in rows):
                    raise ProbeError('Positive fixture missing or mixed: '+label)
            elif rows:raise ProbeError('Unauthorized REST rows: '+label)
            results.append({'case':label,'result':'PASS'})

        rest('REST-A2-own',config.a2,'qa-a',True)
        rest('REST-B2-own',config.b2,'qa-b',True)
        rest('REST-A1-own-denied',config.a1,'qa-a',False)
        rest('REST-A2-cross-denied',config.a2,'qa-b',False)
        rest('REST-B2-cross-denied',config.b2,'qa-a',False)
        # Positive downloads prove fixtures exist before negative access is tested.
        for project,owner,other in [('qa-a',config.a2,config.b2),('qa-b',config.b2,config.a2)]:
            path='/storage/v1/object/authenticated/qa-security-probes/'+project+'/probe.txt'
            status,body=get(path,owner)
            if status!=200 or body!=('ADPHOR '+project+' SYNTHETIC PROBE\n').encode():
                raise ProbeError('Positive Storage fixture missing or invalid')
            results.append({'case':'STORAGE-'+project+'-own','result':'PASS'})
            status,_=get(path,other)
            if status not in (401,403,404):raise ProbeError('Cross Storage access not denied')
            results.append({'case':'STORAGE-'+project+'-cross-denied','result':'PASS'})
        status,_=get('/storage/v1/object/authenticated/qa-security-probes/qa-a/probe.txt',config.a1)
        if status not in (401,403,404):raise ProbeError('AAL1 Storage access not denied')
        results.append({'case':'STORAGE-A1-denied','result':'PASS'})
    return {'scope':'QA read probes only; writes/revocation/public URLs/RPC not covered','results':results}


def main():
    names=['ADPHOR_QA_REF','ADPHOR_QA_PUBLIC_KEY','ADPHOR_QA_A_AAL1','ADPHOR_QA_A_AAL2','ADPHOR_QA_B_AAL2']
    if os.environ.get('ADPHOR_QA_PROBES_AUTHORIZED')!='synthetic-only' or any(not os.environ.get(n) for n in names):
        print(json.dumps({'status':'NOT RUN','reason':'Independent synthetic QA configuration required'}));return 2
    try:
        report=run(Config(*(os.environ[n] for n in names)))
        print(json.dumps(report));return 0
    except ProbeError as e:
        print(json.dumps({'status':'FAIL','reason':str(e)}));return 1
    except Exception:
        print(json.dumps({'status':'FAIL','reason':'Unexpected probe error; no response data logged'}));return 1

if __name__=='__main__':raise SystemExit(main())
