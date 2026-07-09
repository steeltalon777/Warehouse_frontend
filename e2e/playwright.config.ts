import path from 'node:path';
import { defineConfig } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL || 'http://localhost:8001';
const isCI = !!process.env.CI;
const testResultsDir = path.resolve(__dirname, '..', 'test-results');
const reportDir = path.resolve(__dirname, '..', 'playwright-html-report');

export default defineConfig({
  testDir: '.',
  timeout: 30000,
  retries: isCI ? 2 : 0,
  globalSetup: require.resolve('./global-setup'),
  outputDir: testResultsDir,
  use: {
    baseURL,
    headless: true,
    viewport: { width: 1280, height: 720 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: reportDir }],
  ],
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
    // {
    //   name: 'firefox',
    //   use: { browserName: 'firefox' },
    // },
    // {
    //   name: 'webkit',
    //   use: { browserName: 'webkit' },
    // },
  ],
});
