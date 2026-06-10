import { Page, test } from '@playwright/test';

export function installNetworkGuard(page: Page): void {
  page.on('request', request => {
    const url = request.url();
    if (url.includes('localhost:8000') && !url.includes('/health')) {
      test.fail(true, `Browser made direct SyncServer call: ${url}`);
    }
    if (url.includes('/api/v1/') && !url.includes('/bff/')) {
      test.fail(true, `Browser made direct SyncServer API call: ${url}`);
    }
  });
}
