import { defineConfig } from 'vite';

export default defineConfig({
  server: { port: 8000, host: true },
  preview: { port: 8000, host: true },
  build: { outDir: 'dist', emptyOutDir: true, sourcemap: false, target: 'es2020' },
});