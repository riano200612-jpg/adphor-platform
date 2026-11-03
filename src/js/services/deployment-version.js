// Deployment provenance available in the UI, never a claim that services are operational.
// Vite replaces this symbol with CF_PAGES_COMMIT_SHA only when provided by Cloudflare.
const raw = typeof __ADPHOR_BUILD_SHA__ === 'string' ? __ADPHOR_BUILD_SHA__ : '';
export const ADPHOR_DEPLOY_SHA = /^[a-f0-9]{40}$/.test(raw) ? raw : '';
export const ADPHOR_DEPLOY_LABEL = ADPHOR_DEPLOY_SHA
 ? 'Versión Cloudflare · ' + ADPHOR_DEPLOY_SHA.slice(0,8)
 : 'Versión sin SHA verificable';
