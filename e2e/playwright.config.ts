import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  timeout: 30000,
  retries: process.env.CI ? 2 : 0,
  globalSetup: require.resolve('./global-setup'),
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:8001',
    headless: true,
    viewport: { width: 1280, height: 720 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
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
