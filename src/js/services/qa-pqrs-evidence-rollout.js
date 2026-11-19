import {QA_URL,QA_REF,QA_INTEGRAL_HOST} from './qa-auth-policy.js';

// Browser capability is NOT a grant: Supabase AAL2, RLS and Storage policies
// validate the actor, case and property again at upload and retrieval time.
// Only the official Access-protected QA Integral origin may activate this
// rollout. Historical previews, local demos and production fail closed.
export function qaPrivatePqrsEvidenceAllowed({
  url='',qaFlag='',portoEnabled='',stagingRef='',hostname=''
}={}){
  return url===QA_URL&&qaFlag==='true'&&portoEnabled==='true'&&
    stagingRef===QA_REF&&hostname===QA_INTEGRAL_HOST;
}
