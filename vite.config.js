import { defineConfig, loadEnv } from 'vite';
import { assertQaBuildAuth, publicQaBuildConfig } from './src/js/services/qa-auth-policy.js';
import { fileURLToPath, URL } from 'node:url';

// Public production branch may build the same vetted modern UI as protected QA.
// Other QA branches still require the explicit Access/staging build opt-in.
const productionPages = process.env.CF_PAGES === '1'
  && process.env.CF_PAGES_BRANCH === 'codex/flujo-mantenimiento';
const protectedStaging = process.env.CF_PAGES === '1'
  && ['qa/premium-ux-20261030','qa/cliente-integracion-verificada-20261102','qa/cliente-preview-real-readonly-20261103','qa/p1-integracion-modulos-gate-20261103'].includes(process.env.CF_PAGES_BRANCH)
  && process.env.ADPHOR_PROTECTED_STAGING_QA === 'true';
// Consolidated QA branch is a separate, explicitly gated preview. Never enable
// ADPHOR_QA_ACCESS_VERIFIED before verifying Access on the exact preview hostname.
const consolidatedQa = process.env.CF_PAGES === '1'
  && process.env.CF_PAGES_BRANCH === 'qa/pqrs-carrusel-integracion-20261104'
  && process.env.ADPHOR_PROTECTED_STAGING_QA === 'true'
  && process.env.ADPHOR_QA_ACCESS_VERIFIED === 'true';
// Bootstrap publishes only an isolated static page; it never enables the app.
const accessBootstrap = process.env.CF_PAGES === '1'
  && process.env.CF_PAGES_BRANCH === 'qa/pqrs-carrusel-integracion-20261104'
  && process.env.ADPHOR_PROTECTED_STAGING_QA === 'true'
  && process.env.ADPHOR_QA_ACCESS_BOOTSTRAP === 'true';
if ((process.env.CF_PAGES || process.env.WORKERS_CI) && !productionPages && !protectedStaging && !consolidatedQa && !accessBootstrap) {
  throw new Error('QA_DEPLOY_BLOCKED: expected production branch or explicitly protected QA staging');
}

// Cloudflare Pages automatically provides CF_PAGES_COMMIT_SHA for each build.
// Only expose an actual hexadecimal commit identifier. Never expose build secrets.
const buildSha = /^[a-f0-9]{40}$/i.test(process.env.CF_PAGES_COMMIT_SHA || '')
  ? process.env.CF_PAGES_COMMIT_SHA.toLowerCase() : '';
export default defineConfig(({mode}) => {
  const effectiveEnv={...loadEnv(mode,process.cwd(),''),...process.env};
  if(consolidatedQa && !accessBootstrap)assertQaBuildAuth(effectiveEnv);
  return {
  ...((consolidatedQa && !accessBootstrap) ? {plugins:[{
    name:'qa-auth-artifact-config',
    generateBundle(){this.emitFile({type:'asset',fileName:'qa-auth-config.json',source:JSON.stringify(publicQaBuildConfig(effectiveEnv,{sha:buildSha,branch:process.env.CF_PAGES_BRANCH}))});},
  }]} : {}),
  ...(accessBootstrap ? {
    root: fileURLToPath(new URL('./qa/access-bootstrap/', import.meta.url)),
    publicDir: false, envPrefix: [],
    plugins: [{name: 'access-bootstrap-isolation', enforce: 'post', generateBundle(_options, bundle) {
      if (Object.keys(bundle).length !== 1 || bundle['index.html']?.type !== 'asset') {
        throw new Error('QA_BOOTSTRAP_BLOCKED: only the static verification page may be published');
      }
    }}],
  } : {}),
  define: { __ADPHOR_BUILD_SHA__: JSON.stringify(buildSha) },
  // Cloudflare Pages sirve desde la raiz; GitHub Pages mantiene su subruta histórica.
  base: process.env.CF_PAGES === '1' ? '/' : '/adphor-platform/',
  server: { port: 8000, host: '127.0.0.1', proxy: process.env.VITE_AGENTS_API_URL === 'http://localhost:5173' ? {
    '/agent-runs': { target: 'http://127.0.0.1:8000', changeOrigin: true },
  } : undefined },
  preview: { port: 8000, host: '127.0.0.1' },
  build: { outDir: fileURLToPath(new URL('./dist', import.meta.url)), emptyOutDir: true, sourcemap: false, target: 'es2020',
    rollupOptions: { input: {
      main: fileURLToPath(new URL(accessBootstrap ? './qa/access-bootstrap/index.html' : './index.html', import.meta.url)),
      ...(!accessBootstrap && process.env.ADPHOR_BUILD_QA_DEMOS === 'true' ? {
        'qa/cliente': fileURLToPath(new URL('./qa/cliente.html', import.meta.url)),
        'qa/simulacion-operativa': fileURLToPath(new URL('./qa/simulacion-operativa.html', import.meta.url)),
        'qa/datos-reales': fileURLToPath(new URL('./qa/datos-reales.html', import.meta.url)),
      } : {}),
    } },
  },
};
});
