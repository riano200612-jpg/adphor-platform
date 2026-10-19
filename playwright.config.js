import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:8000/adphor-platform/', viewport: { width: 1440, height: 1000 }, launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox','--disable-dev-shm-usage'] } : {}, screenshot: 'only-on-failure' },
  webServer: { command: 'npm run dev -- --host 127.0.0.1', url: 'http://127.0.0.1:8000/adphor-platform/', reuseExistingServer: !process.env.CI },
});
