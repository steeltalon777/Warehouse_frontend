import { test, expect } from '@playwright/test';
import { loginAsRoot } from './helpers/login';

/**
 * Smoke tests for V3.1 Logging infrastructure.
 *
 * Checks:
 * 1. HTTP error interceptor logs `[HTTP]` when BFF returns 403
 * 2. GlobalErrorHandler logs `[GlobalError]` on uncaught error
 * 3. Tokens/secrets are NOT present in console output
 *
 * Prerequisites:
 * - Django stand at http://localhost:8001 with admin/admin123 login
 * - Angular bundle built and served through Django
 */
test.describe('V3.1 Logging smoke', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsRoot(page);
  });

  test('[HTTP] interceptor logs 403 error in console', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Intercept BFF operations call and return 403
    await page.route('**/bff/api/v1/operations**', (route) => {
      route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ ok: false, error: { code: 'forbidden', message: 'Forbidden' } }),
      });
    });

    // Navigate to operations page — data fetch will return 403
    await page.goto('/operations/', { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2000);

    // Check that at least one [HTTP] message exists
    const httpMessages = consoleErrors.filter(msg => msg.includes('[HTTP]'));
    expect(httpMessages.length).toBeGreaterThanOrEqual(1);

    // Verify [HTTP] message format contains method, status
    const sampleMsg = httpMessages[0];
    expect(sampleMsg).toContain('GET');
    expect(sampleMsg).toContain('403');

    // Verify no tokens in console output
    for (const msg of consoleErrors) {
      expect(msg).not.toContain('X-User-Token');
      expect(msg).not.toContain('X-Device-Token');
      expect(msg).not.toContain('sync_user_token');
    }
  });

  test('[GlobalError] appears on uncaught error', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto('/operations/', { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1000);

    // Trigger an uncaught error via setTimeout
    await page.evaluate(() => {
      setTimeout(() => {
        throw new Error('PW_TEST_UNCAUGHT_ERROR');
      }, 100);
    });

    await page.waitForTimeout(2000);

    // Check for [GlobalError] in console
    const globalErrorMessages = consoleErrors.filter(msg => msg.includes('[GlobalError]'));
    expect(globalErrorMessages.length).toBeGreaterThanOrEqual(1);

    // Verify token absence
    for (const msg of consoleErrors) {
      expect(msg).not.toContain('X-User-Token');
      expect(msg).not.toContain('X-Device-Token');
    }
  });

});
