import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

// QA branch: cloud deployment is blocked until Access and staging are verified.
if (process.env.CF_PAGES || process.env.WORKERS_CI) {
  throw new Error('QA_DEPLOY_BLOCKED: independent access review required');
}

export default defineConfig({
  base: '/adphor-platform/',
  server: { port: 8000, host: true, proxy: process.env.VITE_AGENTS_API_URL === 'http://localhost:5173' ? {
    '/agent-runs': { target: 'http://127.0.0.1:8000', changeOrigin: true },
  } : undefined },
  preview: { port: 8000, host: true },
  build: { outDir: 'dist', emptyOutDir: true, sourcemap: false, target: 'es2020',
    rollupOptions: { input: {
      main: fileURLToPath(new URL('./index.html', import.meta.url)),
      ...(process.env.ADPHOR_BUILD_QA_DEMOS === 'true' ? {
        'qa/cliente': fileURLToPath(new URL('./qa/cliente.html', import.meta.url)),
      } : {}),
    } },
  },
});
