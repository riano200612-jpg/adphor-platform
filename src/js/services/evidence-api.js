import {createPrivateEvidenceRepository} from './private-evidence-repository.js';
import {agentApiOrigin} from './agent-api.js';
export function createEvidenceApiRepository({url,enabled,stagingRef,origin,auth,development=false,fetcher=fetch}){
 const allowed=enabled==='true'&&/^[a-z0-9]{20}$/.test(stagingRef||'')&&stagingRef!=='oqizvirqjwbbhyyjpthq'&&url===`https://${stagingRef}.supabase.co`;
 const base=agentApiOrigin(origin,development);
 if(!allowed||!base)return null;
 return createPrivateEvidenceRepository({async putCaseEvidence({projectId,caseId,kind,file}){
  const {data,error}=await auth.getSession();
  if(error||!data?.session?.access_token)throw Error('Sesión necesaria.');
  const path=`/qa/projects/${encodeURIComponent(projectId)}/cases/${encodeURIComponent(caseId)}/evidence`;
  const response=await fetcher(new URL(path+'?kind='+encodeURIComponent(kind),base),{
   method:'POST',headers:{'Content-Type':file.type,Authorization:`Bearer ${data.session.access_token}`},body:file,
   credentials:'omit',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(60000)});
  if(!response.ok)throw Error('No se confirmó la evidencia privada.');
  return response.json();
 }});
}
