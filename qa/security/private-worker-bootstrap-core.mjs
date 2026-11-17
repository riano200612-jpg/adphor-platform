/**
 * Single-use, fail-closed Cloudflare QA Worker bootstrap verification.
 * Never prints tokens, request bodies, or credentials. No mutations.
 * Deployment is handled only by the explicitly selected pywrangler config.
 */
export const ACCOUNT_ID = 'd7c467dca048f6f09a93d78bb59e616d';
export const WORKER_NAME = 'adphor-ai-qa';
export const QA_URL = 'https://qa-integral-claude-reviewed.adphor-platform.pages.dev';
export function validateQaDestination(url) {
  if(url !== QA_URL) {
    throw Error('QA environment URL differs from the only approved QA Integral destination.');
  }
}

export function validateConfig(config) {
  if(!config || config.name !== WORKER_NAME || config.workers_dev !== false ||
     config.preview_urls !== false || config.main !== 'src/worker.py' ||
     !Array.isArray(config.compatibility_flags) ||
     !config.compatibility_flags.includes('python_workers') ||
     config.routes || config.route || config.triggers ||
     !config.vars || config.vars.QA_PRIVATE_SERVICE_ONLY !== 'true' ||
     config.vars.QA_AGENT_READONLY_ENABLED !== 'false' ||
     config.vars.SUPABASE_URL !== 'https://qfctnnnnltghepwujpdm.supabase.co' ||
     config.vars.ALLOWED_ORIGIN !== 'https://qa-integral-claude-reviewed.adphor-platform.pages.dev' ||
     Object.keys(config.vars).some(k => /key|secret|token|writer/i.test(k))) {
    throw Error('Target QA Worker config is not strictly private and disabled.');
  }
}
export function validateAccount(account) {
  if(account !== ACCOUNT_ID) throw Error('Cloudflare account does not match the certified QA account.');
}
export function assertWorkerState(scripts, phase) {
  if(!Array.isArray(scripts)) throw Error('Workers API returned an invalid list.');
  const count=scripts.filter(x=>x && (x.id===WORKER_NAME || x.name===WORKER_NAME)).length;
  if(phase==='preflight' && count!==0)throw Error('QA Worker already exists: refusing overwrite or redeploy.');
  if(phase==='postflight' && count!==1)throw Error('QA Worker creation not confirmed.');
}
export function assertNoPublicSubdomain(data) {
  if(!data || data.enabled!==false)throw Error('Worker workers.dev subdomain is not confirmed disabled.');
}
export async function runBootstrapCheck(phase, {
  env=process.env,
  fetcher=fetch,
  config=null,
}={}) {
  if(!['preflight','postflight'].includes(phase))throw Error('Invalid bootstrap phase.');
  validateAccount(env.CLOUDFLARE_ACCOUNT_ID);
  validateQaDestination(env.ADPHOR_QA_URL);
  if(typeof env.CLOUDFLARE_API_TOKEN!=='string' ||
     env.CLOUDFLARE_API_TOKEN.length<16)throw Error('Cloudflare QA API credential is unavailable.');
  if(config)validateConfig(config);
  const url='https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT_ID;
  const get=async path=>{
    const result=await fetcher(url+path,{
      method:'GET',redirect:'error',
      headers:{Authorization:'Bearer '+env.CLOUDFLARE_API_TOKEN,'Accept':'application/json'},
    });
    if(!result.ok)throw Error('Cloudflare Worker pre/postflight read failed (HTTP '+result.status+').');
    const data=await result.json();
    if(data?.success!==true)throw Error('Cloudflare API did not confirm success.');
    return data.result;
  };
  const scripts=await get('/workers/scripts');
  assertWorkerState(scripts,phase);
  if(phase==='postflight'){
    const subdomain=await get('/workers/scripts/'+WORKER_NAME+'/subdomain');
    assertNoPublicSubdomain(subdomain);
  }
  return phase==='preflight'?'PRIVATE_QA_WORKER_PREFLIGHT_PASS':'PRIVATE_QA_WORKER_POSTFLIGHT_PASS';
}
