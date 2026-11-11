import {defineConfig} from '@playwright/test';
export default defineConfig({
 testDir:'../tests/e2e',testMatch:['visits-isolated.spec.js','agenda-verified.spec.js','meeting-suggestions.spec.js'],
 fullyParallel:false,workers:1,retries:0,timeout:30000,globalTimeout:180000,
 outputDir:'../test-results/candidate-e2e',
 reporter:[['line'],['html',{outputFolder:'test-results/candidate-report',open:'never'}],['json',{outputFile:'test-results/candidate-results.json'}]],
 use:{baseURL:'http://127.0.0.1:8000/adphor-platform/',viewport:{width:1440,height:1000},
  trace:'retain-on-failure',screenshot:'only-on-failure',launchOptions:{timeout:30000}},
 webServer:{command:'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 8000 --strictPort',
  cwd:new URL('../',import.meta.url).pathname,url:'http://127.0.0.1:8000/adphor-platform/',reuseExistingServer:false,timeout:30000}
});
