import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

// Public production branch may build the same vetted modern UI as protected QA.
// Other QA branches still require the explicit Access/staging build opt-in.
const productionPages = process.env.CF_PAGES === '1'
  && process.env.CF_PAGES_BRANCH === 'codex/flujo-mantenimiento';
const protectedStaging = process.env.CF_PAGES === '1'
  && ['qa/premium-ux-20261030','qa/cliente-integracion-verificada-20261102','qa/cliente-preview-real-readonly-20261103','qa/p1-integracion-modulos-gate-20261103'].includes(process.env.CF_PAGES_BRANCH)
  && process.env.ADPHOR_PROTECTED_STAGING_QA === 'true';
if ((process.env.CF_PAGES || process.env.WORKERS_CI) && !productionPages && !protectedStaging) {
  throw new Error('DEPLOY_BLOCKED: expected production branch or explicitly protected QA staging');
}

export default defineConfig({
  // Cloudflare Pages sirve desde la raiz; GitHub Pages mantiene su subruta histórica.
  base: process.env.CF_PAGES === '1' ? '/' : '/adphor-platform/',
  server: { port: 8000, host: '127.0.0.1', proxy: process.env.VITE_AGENTS_API_URL === 'http://localhost:5173' ? {
    '/agent-runs': { target: 'http://127.0.0.1:8000', changeOrigin: true },
  } : undefined },
  preview: { port: 8000, host: '127.0.0.1' },
  build: { outDir: 'dist', emptyOutDir: true, sourcemap: false, target: 'es2020',
    rollupOptions: { input: {
      main: fileURLToPath(new URL('./index.html', import.meta.url)),
      ...(process.env.ADPHOR_BUILD_QA_DEMOS === 'true' ? {
        'qa/cliente': fileURLToPath(new URL('./qa/cliente.html', import.meta.url)),
        'qa/simulacion-operativa': fileURLToPath(new URL('./qa/simulacion-operativa.html', import.meta.url)),
        'qa/datos-reales': fileURLToPath(new URL('./qa/datos-reales.html', import.meta.url)),
      } : {}),
    } },
  },
});
