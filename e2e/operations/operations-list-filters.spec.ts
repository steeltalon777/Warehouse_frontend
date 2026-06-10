import { expect, Page, test } from '@playwright/test';
import { loginAsRole } from '../helpers/login';
import { installNetworkGuard } from '../helpers/network-guard';

async function login(page: Page) {
  await loginAsRole(page, 'spa_user');
}

test.describe('Operations List Filters', () => {
  test.beforeEach(async ({ page }) => {
    installNetworkGuard(page);
    await login(page);
  });

  test('status tabs use SyncServer-compatible query params', async ({ page }) => {
    await page.goto('/operations/', { waitUntil: 'networkidle' });

    await expect(page.getByRole('button', { name: 'На подтверждении' })).toHaveCount(0);

    await Promise.all([
      page.waitForResponse(response => {
        if (!response.url().includes('/bff/api/v1/operations') || response.request().method() !== 'GET') return false;
        const url = new URL(response.url());
        return response.status() === 200
          && url.searchParams.get('status') === 'submitted'
          && url.searchParams.get('acceptance_state') === 'pending';
      }),
      page.getByRole('button', { name: 'Ожидают приёмки' }).click(),
    ]);
    await expect(page.locator('.error-banner')).toHaveCount(0);

    await Promise.all([
      page.waitForResponse(response => {
        if (!response.url().includes('/bff/api/v1/operations') || response.request().method() !== 'GET') return false;
        const url = new URL(response.url());
        return response.status() === 200
          && url.searchParams.get('status') === 'submitted'
          && !url.searchParams.has('acceptance_state');
      }),
      page.getByRole('button', { name: 'Проведённые' }).click(),
    ]);
    await expect(page.locator('.error-banner')).toHaveCount(0);
  });
});
