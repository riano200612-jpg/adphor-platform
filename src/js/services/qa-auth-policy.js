export const QA_REF = 'qfctnnnnltghepwujpdm';
export const QA_URL = `https://${QA_REF}.supabase.co`;
export const QA_HOST = 'qa-pqrs-carrusel-integracion.adphor-platform.pages.dev';

// The known QA backend enforces AAL2 in SQL. Optional UI flags cannot downgrade it.
export function qaAuthPolicy({url, requireMfa, hostname=''}) {
  const isolatedQa = url === QA_URL;
  if (hostname === QA_HOST && !isolatedQa) {
    throw Error('QA_AUTH_CONFIG_BLOCKED: el portal QA debe usar exclusivamente Supabase QA.');
  }
  return {required: isolatedQa || requireMfa === 'true', isolatedQa};
}

export function assertQaBuildAuth(env) {
  if (env.VITE_SUPABASE_URL !== QA_URL || typeof env.VITE_SUPABASE_ANON_KEY !== 'string' || !env.VITE_SUPABASE_ANON_KEY.trim() || env.VITE_ADPHOR_QA_READONLY === 'true' || env.VITE_REQUIRE_MFA !== 'true'
      || env.VITE_PORTO_QA_ENABLED !== 'true' || env.VITE_PORTO_STAGING_REF !== QA_REF) {
    throw Error('QA_AUTH_CONFIG_BLOCKED: expected isolated QA URL/ref, mandatory MFA and QA enrollment flags.');
  }
}

// Never silently substitute demo data on the known QA portal or QA backend.
export function applicationRepositoryMode({url,key,readonly=false,hostname=''}) {
  const qa=hostname===QA_HOST || url===QA_URL;
  if(qa && (url!==QA_URL || !key || readonly))return 'blocked';
  return !readonly && url && key ? 'cloud' : 'demo';
}

// Build configuration only: these flags are not proof of live Access or AAL2.
export function publicQaBuildConfig(env,{sha='',branch}) {
 assertQaBuildAuth(env);
 if(!['qa/pqrs-carrusel-integracion-20261104','qa/integral-claude-reviewed-20261111'].includes(branch))throw Error('QA_AUTH_CONFIG_BLOCKED: unexpected preview branch.');
 return {
  sha:/^[a-f0-9]{40}$/i.test(sha)?sha.toLowerCase():'',branch,
  backendUrl:QA_URL,requireMfa:env.VITE_REQUIRE_MFA,
  portoQaEnabled:env.VITE_PORTO_QA_ENABLED,portoStagingRef:env.VITE_PORTO_STAGING_REF,
  runtimeMfaRequired:true,publicKeyPresent:true,
  visitsSqlEnabled:env.VITE_VISITS_SQL_ENABLED==='true',
  visitsLifecycleEnabled:env.VITE_VISITS_SQL_ENABLED==='true'&&env.VITE_QA_VISITS_LIFECYCLE_ENABLED==='true',
  readOnlyMode:false,agentsApiConfigured:Boolean(env.VITE_AGENTS_API_URL?.trim()),
  accessVerifiedFlag:env.ADPHOR_QA_ACCESS_VERIFIED==='true',
  accessBootstrapFlag:env.ADPHOR_QA_ACCESS_BOOTSTRAP==='true',
  buildConfigurationOnly:true
 };
}
