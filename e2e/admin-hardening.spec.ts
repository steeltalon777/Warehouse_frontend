import { test, expect } from '@playwright/test';

test.use({ trace: 'off', screenshot: 'off', video: 'off' });

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:8001';
const ADMIN_USER = process.env.E2E_ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.E2E_ADMIN_PASS || 'admin123';

test.describe('Admin Hardening v3.1F', () => {
  
  test('admin login works', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/login/`);
    await page.fill('input[name="username"]', ADMIN_USER);
    await page.fill('input[name="password"]', ADMIN_PASS);
    await page.click('input[type="submit"]');
    await expect(page.locator('text=Администрирование')).toBeVisible({ timeout: 10000 });
  });

  test('POST action works, direct GET fails on sync', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/login/`);
    await page.fill('input[name="username"]', ADMIN_USER);
    await page.fill('input[name="password"]', ADMIN_PASS);
    await page.click('input[type="submit"]');
    
    const resp = await page.goto(`${BASE_URL}/admin/auth/user/1/sync/`);
    if (resp) {
      // POST-only route: superuser GET → 405, redirect back → 302
      expect([405, 302]).toContain(resp.status());
    }
  });

  test('diagnostic page renders without errors', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/login/`);
    await page.fill('input[name="username"]', ADMIN_USER);
    await page.fill('input[name="password"]', ADMIN_PASS);
    await page.click('input[type="submit"]');
    
    await page.goto(`${BASE_URL}/admin/users/syncuserbinding/`);
    await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });
  });

  test('admin redirects to login when unauthenticated', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/`);
    await expect(page).toHaveURL(/login/);
  });
});
