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
  if (env.VITE_SUPABASE_URL !== QA_URL || env.VITE_REQUIRE_MFA !== 'true'
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
